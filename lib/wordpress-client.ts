// lib/wordpress-client.ts
import { SyncStatus } from "../src/types";
import { isSafeUrlForSsrf, safeFetch } from "../server/security";
import { SyncFailureStore } from "./sync-failure-store";
import { DbEngine } from "../server/db";

export interface WordPressProductResponse {
  id: number;
  name: string;
  sku?: string;
  status: string;
  description: string;
  short_description: string;
  images: { id: number; src: string; alt: string }[];
}

export interface WordPressPostResponse {
  id: number;
  title: { rendered: string };
  status: string;
  content: { rendered: string };
  excerpt: { rendered: string };
}

export class WordPressError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "WordPressError";
  }
}

export const WordPressClient = {
  /**
   * Helper to perform a fetch with retry capability on transient failures and AbortController timeout.
   */
  async fetchWithRetry(
    url: string, 
    options: RequestInit, 
    retries = 3, 
    delayMs = 1000, 
    timeoutMs = 15000
  ): Promise<Response> {
    if (!(await isSafeUrlForSsrf(url))) {
      throw new Error(`SSRF Blocked: URL resolved to public/private forbidden IP networks.`);
    }

    let lastError: any = null;
    
    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      
      try {
        const response = await safeFetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        // Handle explicit client authentication / authorization failures immediately (no retry)
        if (response.status === 401) {
          throw new WordPressError(401, "401 Application password invalid");
        }
        if (response.status === 403) {
          throw new WordPressError(403, "403 Cloudflare blocked request");
        }
        if (response.status === 404) {
          throw new WordPressError(404, "404 Resource not found");
        }
        
        // Treat transient status codes as retryable (429 Rate Limit, 500-504 Server Side Failures)
        if (response.status === 429 || (response.status >= 500 && response.status <= 504)) {
          console.warn(`[WordPressClient] Transient HTTP status ${response.status} met on attempt ${i + 1}. Retrying...`);
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
            continue;
          }
          if (response.status === 429) {
            throw new WordPressError(429, "429 Rate limit reached");
          }
          throw new WordPressError(response.status, "500 PHP server error");
        }
        
        return response;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        
        const isTimeout = err.name === "AbortError";
        console.warn(
          `[WordPressClient] ${isTimeout ? 'Timeout duration exceeded' : 'Network communication error'} on attempt ${i + 1}: ${err.message}. Retrying...`
        );
        
        // If it's a structural WordPressError (like 401/403/404), bubble it up immediately
        if (err instanceof WordPressError) {
          throw err;
        }

        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
        }
      }
    }
    
    throw lastError || new Error(`Failed to establish connection to WordPress REST API after ${retries} attempts.`);
  },

  /**
   * Validate that the credentials and base WordPress REST API can be reached and authenticated.
   */
  async validateCredentials(siteUrl: string, username: string, appPassword: string): Promise<{ success: boolean; details?: string }> {
    const cleanUrl = siteUrl.replace(/\/+$/, "");
    const authString = Buffer.from(`${username}:${appPassword}`).toString("base64");
    
    try {
      // Test the 'users/me' endpoint to verify credentials with a strict 15s timeout
      const testUrl = `${cleanUrl}/wp-json/wp/v2/users/me`;
      const response = await this.fetchWithRetry(testUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/json",
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
        }
      }, 3, 1000, 15000);

      if (!response.ok) {
        return { success: false, details: `WordPress responded with HTTP status ${response.status}` };
      }

      return { success: true };
    } catch (error: any) {
      console.error(`[WordPressClient] Credentials verification failed for ${siteUrl}: ${error.message}`);
      return { success: false, details: error.message || "Failed to connect to the remote WordPress instance." };
    }
  },

  /**
   * Query the WordPress namespace routes to check for WooCommerce presence with timeout.
   */
  async checkWooCommerce(siteUrl: string, username: string, appPassword: string): Promise<boolean> {
    const cleanUrl = siteUrl.replace(/\/+$/, "");
    const authString = Buffer.from(`${username}:${appPassword}`).toString("base64");
    
    try {
      const response = await this.fetchWithRetry(`${cleanUrl}/wp-json`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authString}`,
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
        }
      }, 3, 1000, 15000);

      if (!response.ok) return false;
      const indexObj = await response.json();
      const namespaces: string[] = indexObj.namespaces || [];
      return namespaces.includes("wc/v3");
    } catch (e) {
      console.warn(`[WordPressClient] WooCommerce probe met lookup error: ${e}. Running fallback check...`);
      return false;
    }
  },

  /**
   * Retrieve products/posts from WordPress. Resolves pagination up to 100 total items limit.
   */
  async importWordPressItems(
    siteUrl: string, 
    username: string, 
    appPassword: string, 
    isWooCommerce: boolean
  ): Promise<{ products: WordPressProductResponse[] }> {
    const cleanUrl = siteUrl.replace(/\/+$/, "");
    const authString = Buffer.from(`${username}:${appPassword}`).toString("base64");

    try {
      const allProducts: WordPressProductResponse[] = [];
      let page = 1;
      const perPage = 50; // Dynamic batch page sizing
      let hasMore = true;

      // In real SaaS deployments, constrain pagination looping up to 100 items upper limit
      while (hasMore && allProducts.length < 100) {
        const queryLimit = Math.min(perPage, 100 - allProducts.length);
        const endpoint = isWooCommerce 
          ? `${cleanUrl}/wp-json/wc/v3/products?page=${page}&per_page=${queryLimit}` 
          : `${cleanUrl}/wp-json/wp/v2/posts?page=${page}&per_page=${queryLimit}&_embed=1`;
          
        const response = await this.fetchWithRetry(endpoint, {
          method: "GET",
          headers: {
            "Authorization": `Basic ${authString}`,
            "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
          }
        }, 3, 1000, 15000);

        if (!response.ok) {
          throw new WordPressError(response.status, `WordPress API endpoint returned error code ${response.status}`);
        }

        const rawItems = await response.json();
        
        if (!Array.isArray(rawItems) || rawItems.length === 0) {
          hasMore = false;
          break;
        }

        if (isWooCommerce) {
          const mappedBatch: WordPressProductResponse[] = rawItems.map((p: any) => ({
            id: p.id,
            name: p.name || "Unnamed WooCommerce Item",
            sku: p.sku || "N/A",
            status: p.status || "publish",
            description: p.description || "",
            short_description: p.short_description || "",
            images: (p.images || []).map((img: any) => ({
              id: img.id,
              src: img.src,
              alt: img.alt || ""
            }))
          }));
          allProducts.push(...mappedBatch);
        } else {
          // Fallback mapping standard blog posts into product structure
          const mappedBatch: WordPressProductResponse[] = rawItems.map((post: any) => ({
            id: post.id,
            name: post.title?.rendered || "Unnamed Blog Post",
            sku: `WP-P-${post.id}`,
            status: post.status || "publish",
            description: post.content?.rendered || "",
            short_description: post.excerpt?.rendered || "",
            images: post._embedded?.["wp:featuredmedia"]?.map((m: any) => ({
              id: m.id,
              src: m.source_url,
              alt: m.alt_text || ""
            })) || []
          }));
          allProducts.push(...mappedBatch);
        }

        // Check if there is another page based on WordPress total pages response header
        const totalPagesHeader = response.headers.get("X-WP-TotalPages");
        if (totalPagesHeader) {
          const totalPages = parseInt(totalPagesHeader, 10);
          if (page >= totalPages) {
            hasMore = false;
          }
        } else if (rawItems.length < queryLimit) {
          hasMore = false;
        }

        page++;
      }

      if (allProducts.length === 0) {
        throw new Error("No products or posts found on remote WordPress site.");
      }

      return { products: allProducts };
    } catch (err: any) {
      console.error(`[WordPressClient] Real REST pull failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Sync the optimized SEO improvements back to WordPress. Handles timeout and failure retries.
   * Processes steps: Read-Before-Write, Write update payload, Verify-After-Write, and Rollback on discrepancies.
   * Automatically adds action logs for auditing state changes in WordPress.
   */
  async syncItemUpdates(
    siteUrl: string, 
    username: string, 
    appPassword: string, 
    externalId: number, 
    isWooCommerce: boolean, 
    updates: { 
      name?: string; 
      description?: string; 
      shortDescription?: string;
      metaTitle?: string;
      metaDescription?: string;
      imageAltText?: string;
    },
    siteId?: string
  ): Promise<{ success: boolean; syncedAt: string; response?: any }> {
    const cleanUrl = siteUrl.replace(/\/+$/, "");
    const authString = Buffer.from(`${username}:${appPassword}`).toString("base64");
    const productName = updates.name || `Asset #${externalId}`;

    const logAndRecordAudit = (
      action: "SYNC_START" | "SYNC_SUCCESS" | "SYNC_FAILURE" | "RETRY_ATTEMPT" | "READ_BEFORE_WRITE" | "VERIFY_AFTER_WRITE" | "ROLLBACK_SUCCESS" | "ROLLBACK_FAILED" | "ROLLBACK_TRIGGERED", 
      details: string
    ) => {
      try {
        SyncFailureStore.recordAudit(externalId.toString(), productName, siteUrl, action as any, details);
      } catch (err) {
        console.error("[WordPressClient Audit Log Error]", err);
      }
    };

    logAndRecordAudit("SYNC_START", `Initiated WordPress standard SEO optimization transaction for ID: ${externalId}`);

    // --- STEP 1: READ BEFORE WRITE (Snapshot Phase) ---
    let snapshot: {
      name: string;
      description: string;
      shortDescription: string;
      metaTitle: string;
      metaDescription: string;
      imageAltText: string;
      featuredMediaId?: number;
      originalResponse: any;
    };

    try {
      const getEndpoint = isWooCommerce 
        ? `${cleanUrl}/wp-json/wc/v3/products/${externalId}` 
        : `${cleanUrl}/wp-json/wp/v2/posts/${externalId}`;

      const response = await this.fetchWithRetry(getEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authString}`,
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
        }
      }, 3, 1000, 15000);

      if (!response.ok) {
        throw new WordPressError(response.status, `Read-before-write GET check failed with response status: ${response.status}`);
      }

      const body = await response.json();
      
      // Extract existing SEO metadata
      let metaTitle = "";
      let metaDescription = "";
      if (isWooCommerce) {
        const metaData = body.meta_data || [];
        const yTitle = metaData.find((m: any) => m.key === "_yoast_wpseo_title")?.value;
        const rTitle = metaData.find((m: any) => m.key === "rank_math_title")?.value;
        metaTitle = yTitle || rTitle || "";

        const yDesc = metaData.find((m: any) => m.key === "_yoast_wpseo_metadesc")?.value;
        const rDesc = metaData.find((m: any) => m.key === "rank_math_description")?.value;
        metaDescription = yDesc || rDesc || "";
      } else {
        const meta = body.meta || {};
        metaTitle = meta._yoast_wpseo_title || meta.rank_math_title || "";
        metaDescription = meta._yoast_wpseo_metadesc || meta.rank_math_description || "";
      }

      // Extract image alt text
      let imageAltText = "";
      let featuredMediaId: number | undefined;
      
      if (isWooCommerce) {
        const images = body.images || [];
        if (images.length > 0) {
          imageAltText = images[0].alt || "";
        }
      } else {
        featuredMediaId = body.featured_media;
        if (featuredMediaId && featuredMediaId > 0) {
          try {
            const mediaResponse = await this.fetchWithRetry(`${cleanUrl}/wp-json/wp/v2/media/${featuredMediaId}`, {
              method: "GET",
              headers: {
                "Authorization": `Basic ${authString}`,
                "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
              }
            }, 3, 1000, 15000);
            if (mediaResponse.ok) {
              const mediaObj = await mediaResponse.json();
              imageAltText = mediaObj.alt_text || "";
            }
          } catch (e) {
            console.warn(`[WordPressClient] Could not fetch standard post featured media ${featuredMediaId} alt text details:`, e);
          }
        }
      }

      snapshot = {
        name: isWooCommerce ? (body.name || "") : (body.title?.rendered || ""),
        description: isWooCommerce ? (body.description || "") : (body.content?.rendered || ""),
        shortDescription: isWooCommerce ? (body.short_description || "") : (body.excerpt?.rendered || ""),
        metaTitle,
        metaDescription,
        imageAltText,
        featuredMediaId,
        originalResponse: body
      };

      logAndRecordAudit("READ_BEFORE_WRITE", `Successfully read pre-write state. Title: "${snapshot.name.substring(0, 30)}", Alt Text: "${snapshot.imageAltText}"`);

      // Automatically capture dynamic Restore Point snapshot prior to write operation
      if (siteId) {
        try {
          await DbEngine.createRestorePoint({
            siteId,
            resourceId: externalId,
            title: snapshot.name,
            description: snapshot.shortDescription || null,
            content: snapshot.description || null,
            metaFields: JSON.stringify(isWooCommerce ? (body.meta_data || []) : (body.meta || {})),
            images: JSON.stringify(isWooCommerce ? (body.images || []) : { featuredMediaId, imageAltText }),
          });
          console.log(`[WordPressClient] Automatically captured Restore Point snapshot for Resource ID ${externalId}`);
        } catch (dbErr) {
          console.error(`[WordPressClient] Non-blocking database pre-sync snapshot capture failed:`, dbErr);
        }
      }
    } catch (readErr: any) {
      logAndRecordAudit("SYNC_FAILURE", `Read-before-write inspection step failed: ${readErr.message}`);
      throw readErr;
    }

    // --- STEP 2: WRITE CHANGES ---
    let writeResponse: any;
    try {
      const endpoint = isWooCommerce 
        ? `${cleanUrl}/wp-json/wc/v3/products/${externalId}` 
        : `${cleanUrl}/wp-json/wp/v2/posts/${externalId}`;

      const payload: any = {};
      
      if (isWooCommerce) {
        if (updates.name) payload.name = updates.name;
        if (updates.description) payload.description = updates.description;
        if (updates.shortDescription) payload.short_description = updates.shortDescription;
        
        // SEO plugin support in meta_data
        const updatedMeta = [...(snapshot.originalResponse.meta_data || [])];
        const upsertMeta = (key: string, value: string) => {
          const idx = updatedMeta.findIndex((m: any) => m.key === key);
          if (idx !== -1) {
            updatedMeta[idx].value = value;
          } else {
            updatedMeta.push({ key, value });
          }
        };

        if (updates.metaTitle) {
          upsertMeta("_yoast_wpseo_title", updates.metaTitle);
          upsertMeta("rank_math_title", updates.metaTitle);
          upsertMeta("_seopress_titles_title", updates.metaTitle);
          upsertMeta("_aioseo_title", updates.metaTitle);
          upsertMeta("_genesis_title", updates.metaTitle);
        }
        if (updates.metaDescription) {
          upsertMeta("_yoast_wpseo_metadesc", updates.metaDescription);
          upsertMeta("rank_math_description", updates.metaDescription);
          upsertMeta("_seopress_titles_desc", updates.metaDescription);
          upsertMeta("_aioseo_description", updates.metaDescription);
          upsertMeta("_genesis_description", updates.metaDescription);
        }
        if (updates.metaTitle || updates.metaDescription) {
          payload.meta_data = updatedMeta;
        }

        // Image Alt text updates inline in product images array
        if (updates.imageAltText) {
          const wcImages = [...(snapshot.originalResponse.images || [])];
          if (wcImages.length > 0) {
            wcImages[0].alt = updates.imageAltText;
            payload.images = wcImages;
          }
        }
      } else {
        if (updates.name) payload.title = updates.name;
        if (updates.description) payload.content = updates.description;
        if (updates.shortDescription) payload.excerpt = updates.shortDescription;

        // Custom meta for standard WP posts
        const currentMeta = snapshot.originalResponse.meta || {};
        const updatedMeta = { ...currentMeta };
        
        if (updates.metaTitle) {
          updatedMeta._yoast_wpseo_title = updates.metaTitle;
          updatedMeta.rank_math_title = updates.metaTitle;
          updatedMeta._seopress_titles_title = updates.metaTitle;
          updatedMeta._aioseo_title = updates.metaTitle;
          updatedMeta._genesis_title = updates.metaTitle;
        }
        if (updates.metaDescription) {
          updatedMeta._yoast_wpseo_metadesc = updates.metaDescription;
          updatedMeta.rank_math_description = updates.metaDescription;
          updatedMeta._seopress_titles_desc = updates.metaDescription;
          updatedMeta._aioseo_description = updates.metaDescription;
          updatedMeta._genesis_description = updates.metaDescription;
        }
        if (updates.metaTitle || updates.metaDescription) {
          payload.meta = updatedMeta;
        }

        // Standard WP posts update featured media alt text via dedicated REST endpoint
        if (updates.imageAltText && snapshot.featuredMediaId && snapshot.featuredMediaId > 0) {
          try {
            await this.fetchWithRetry(`${cleanUrl}/wp-json/wp/v2/media/${snapshot.featuredMediaId}`, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json",
                "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
              },
              body: JSON.stringify({ alt_text: updates.imageAltText })
            }, 3, 1000, 15000);
          } catch (e) {
            console.error(`[WordPressClient] Non-blocking fail writing standard post's featured media alt_text:`, e);
          }
        }
      }

      logAndRecordAudit("RETRY_ATTEMPT", `Pacing network transaction (1200ms delay safeguard enabled to protect Shared Web hosts)...`);
      await new Promise(resolve => setTimeout(resolve, 1200));

      const response = await this.fetchWithRetry(endpoint, {
        method: isWooCommerce ? "PUT" : "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/json",
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
        },
        body: JSON.stringify(payload)
      }, 3, 1000, 15000);

      if (!response.ok) {
        if (response.status === 401) {
          throw new WordPressError(401, "401 Application password invalid");
        } else if (response.status === 403) {
          throw new WordPressError(403, "403 Cloudflare blocked request");
        } else if (response.status === 429) {
          throw new WordPressError(429, "429 Rate limit reached");
        } else if (response.status >= 500) {
          throw new WordPressError(response.status, "500 PHP server error");
        } else {
          throw new WordPressError(response.status, `Sync write transaction was declined by WordPress server with HTTP ${response.status}`);
        }
      }

      writeResponse = await response.json();
    } catch (writeErrorNet: any) {
      logAndRecordAudit("SYNC_FAILURE", `Write transaction phase failed: ${writeErrorNet.message}`);
      throw writeErrorNet;
    }

    // --- STEP 3: VERIFY AFTER WRITE ---
    logAndRecordAudit("VERIFY_AFTER_WRITE", `Commencing strict verify-after-write confirmation checks.`);
    let verificationSuccess = true;
    let discrepancyDetails = "";

    try {
      const getEndpoint = isWooCommerce 
        ? `${cleanUrl}/wp-json/wc/v3/products/${externalId}` 
        : `${cleanUrl}/wp-json/wp/v2/posts/${externalId}`;

      const response = await this.fetchWithRetry(getEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authString}`,
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
        }
      }, 3, 1000, 15000);

      if (!response.ok) {
        if (response.status === 401) {
          throw new WordPressError(401, "401 Application password invalid");
        } else if (response.status === 403) {
          throw new WordPressError(403, "403 Cloudflare blocked request");
        } else if (response.status === 429) {
          throw new WordPressError(429, "429 Rate limit reached");
        } else if (response.status >= 500) {
          throw new WordPressError(response.status, "500 PHP server error");
        } else {
          throw new WordPressError(response.status, `Verification GET probe failed with HTTP status ${response.status}`);
        }
      }

      const body = await response.json();

      // Simple normalizer to prevent failures on minor HTML entity / tag differences
      const cleanText = (str: string) => (str || "").replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, "").replace(/\s+/g, " ").trim().toLowerCase();

      // Verify Title
      if (updates.name) {
        const retrievedTitle = isWooCommerce ? (body.name || "") : (body.title?.rendered || "");
        if (cleanText(retrievedTitle) !== cleanText(updates.name)) {
          verificationSuccess = false;
          discrepancyDetails += `[Title Discrepancy: Expected "${updates.name}", got "${retrievedTitle}"] `;
        }
      }

      // Verify Description
      if (updates.description) {
        const retrievedDesc = isWooCommerce ? (body.description || "") : (body.content?.rendered || "");
        const checkExcerpt = cleanText(retrievedDesc);
        const checkTarget = cleanText(updates.description);
        
        // Soft check: some WP servers auto-expand blocks or sanitize scripts
        if (checkExcerpt !== checkTarget && !checkExcerpt.includes(checkTarget) && !checkTarget.includes(checkExcerpt)) {
          verificationSuccess = false;
          discrepancyDetails += `[Description field could not be closely matched] `;
        }
      }

      // Verify Meta Description
      if (updates.metaDescription) {
        let retrievedMetaDesc = "";
        if (isWooCommerce) {
          const metaData = body.meta_data || [];
          retrievedMetaDesc = metaData.find((m: any) => m.key === "_yoast_wpseo_metadesc")?.value || metaData.find((m: any) => m.key === "rank_math_description")?.value || "";
        } else {
          const meta = body.meta || {};
          retrievedMetaDesc = meta._yoast_wpseo_metadesc || meta.rank_math_description || "";
        }

        if (cleanText(retrievedMetaDesc) !== cleanText(updates.metaDescription)) {
          verificationSuccess = false;
          discrepancyDetails += `[SEO Meta Description field verification fallback mismatched] `;
        }
      }

      // Verify Meta Title
      if (updates.metaTitle) {
        let retrievedMetaTitle = "";
        if (isWooCommerce) {
          const metaData = body.meta_data || [];
          retrievedMetaTitle = metaData.find((m: any) => m.key === "_yoast_wpseo_title")?.value || metaData.find((m: any) => m.key === "rank_math_title")?.value || "";
        } else {
          const meta = body.meta || {};
          retrievedMetaTitle = meta._yoast_wpseo_title || meta.rank_math_title || "";
        }

        if (cleanText(retrievedMetaTitle) !== cleanText(updates.metaTitle)) {
          verificationSuccess = false;
          discrepancyDetails += `[SEO Meta Title field verification fallback mismatched] `;
        }
      }

      // Verify Image Alt Text
      if (updates.imageAltText) {
        let retrievedAlt = "";
        if (isWooCommerce) {
          const images = body.images || [];
          if (images.length > 0) {
            retrievedAlt = images[0].alt || "";
          }
        } else if (snapshot.featuredMediaId && snapshot.featuredMediaId > 0) {
          try {
            const mediaRes = await this.fetchWithRetry(`${cleanUrl}/wp-json/wp/v2/media/${snapshot.featuredMediaId}`, {
              method: "GET",
              headers: {
                "Authorization": `Basic ${authString}`,
                "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
              }
            }, 3, 1000, 15000);
            if (mediaRes.ok) {
              const mObj = await mediaRes.json();
              retrievedAlt = mObj.alt_text || "";
            }
          } catch (e) {
            console.error(e);
          }
        }

        if (cleanText(retrievedAlt) !== cleanText(updates.imageAltText)) {
          verificationSuccess = false;
          discrepancyDetails += `[Alt Text field did not match: Expected "${updates.imageAltText}", got "${retrievedAlt}"] `;
        }
      }

    } catch (verifErr: any) {
      verificationSuccess = false;
      discrepancyDetails += `[Verification execution failure error: ${verifErr.message}] `;
    }

    if (verificationSuccess) {
      logAndRecordAudit("SYNC_SUCCESS", `Verify-after-write OK. Synchronized fields confirmed.`);
      return { success: true, syncedAt: new Date().toISOString(), response: writeResponse };
    }

    // --- STEP 4: ROLLBACK WORKFLOW (Verification Failed) ---
    logAndRecordAudit("ROLLBACK_TRIGGERED", `Strictest verify-after-write failed! Triggering automated rollback. Reason: ${discrepancyDetails}`);
    
    try {
      const rollbackPayload: any = {};
      if (isWooCommerce) {
        rollbackPayload.name = snapshot.name;
        rollbackPayload.description = snapshot.description;
        rollbackPayload.short_description = snapshot.shortDescription;

        // Restore original meta
        rollbackPayload.meta_data = snapshot.originalResponse.meta_data || [];
        
        // Restore image alt
        rollbackPayload.images = snapshot.originalResponse.images || [];
      } else {
        rollbackPayload.title = snapshot.name;
        rollbackPayload.content = snapshot.description;
        rollbackPayload.excerpt = snapshot.shortDescription;

        // Restore meta
        rollbackPayload.meta = snapshot.originalResponse.meta || {};

        // Restore media alt
        if (snapshot.imageAltText && snapshot.featuredMediaId && snapshot.featuredMediaId > 0) {
          try {
            await this.fetchWithRetry(`${cleanUrl}/wp-json/wp/v2/media/${snapshot.featuredMediaId}`, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json",
                "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
              },
              body: JSON.stringify({ alt_text: snapshot.imageAltText })
            }, 3, 1000, 15000);
          } catch (e) {
            console.error("[WordPressClient] Rollback featured image alt_text failed:", e);
          }
        }
      }

      const endpoint = isWooCommerce 
        ? `${cleanUrl}/wp-json/wc/v3/products/${externalId}` 
        : `${cleanUrl}/wp-json/wp/v2/posts/${externalId}`;

      const resRollback = await this.fetchWithRetry(endpoint, {
        method: isWooCommerce ? "PUT" : "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/json",
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
        },
        body: JSON.stringify(rollbackPayload)
      }, 3, 1000, 15000);

      if (resRollback.ok) {
        logAndRecordAudit("ROLLBACK_SUCCESS", `Automated rollback accomplished. Restored content on target WordPress instance.`);
      } else {
        logAndRecordAudit("ROLLBACK_FAILED", `Automated rollback attempt was rejected by WordPress server: HTTP status ${resRollback.status}`);
      }
    } catch (rollbackErr: any) {
      logAndRecordAudit("ROLLBACK_FAILED", `Rollback routine collapsed on unexpected error: ${rollbackErr.message}`);
    }

    throw new WordPressError(400, `Verification failed on WordPress sync! Fields discrepant on remote WordPress instance: ${discrepancyDetails}`);
  },

  async rollbackToRestorePoint(
    siteUrl: string,
    username: string,
    appPassword: string,
    isWooCommerce: boolean,
    restorePoint: {
      resourceId: number;
      title: string;
      description: string | null;
      content: string | null;
      metaFields: string | null;
      images: string | null;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const cleanUrl = siteUrl.replace(/\/+$/, "");
    const authString = Buffer.from(`${username}:${appPassword}`).toString("base64");
    
    try {
      const endpoint = isWooCommerce 
        ? `${cleanUrl}/wp-json/wc/v3/products/${restorePoint.resourceId}` 
        : `${cleanUrl}/wp-json/wp/v2/posts/${restorePoint.resourceId}`;

      const payload: any = {};
      
      if (isWooCommerce) {
        payload.name = restorePoint.title;
        if (restorePoint.content !== null) payload.description = restorePoint.content;
        if (restorePoint.description !== null) payload.short_description = restorePoint.description;

        if (restorePoint.metaFields) {
          try {
            payload.meta_data = JSON.parse(restorePoint.metaFields);
          } catch (e) {
            console.error("Failed to parse metaFields JSON during rollback:", e);
          }
        }

        if (restorePoint.images) {
          try {
            payload.images = JSON.parse(restorePoint.images);
          } catch (e) {
            console.error("Failed to parse images JSON during rollback:", e);
          }
        }
      } else {
        payload.title = restorePoint.title;
        if (restorePoint.content !== null) payload.content = restorePoint.content;
        if (restorePoint.description !== null) payload.excerpt = restorePoint.description;

        if (restorePoint.metaFields) {
          try {
            payload.meta = JSON.parse(restorePoint.metaFields);
          } catch (e) {
            console.error("Failed to parse metaFields JSON during rollback:", e);
          }
        }

        if (restorePoint.images) {
          try {
            const imgData = JSON.parse(restorePoint.images);
            const { featuredMediaId, imageAltText } = imgData;
            if (featuredMediaId && featuredMediaId > 0 && imageAltText) {
              await this.fetchWithRetry(`${cleanUrl}/wp-json/wp/v2/media/${featuredMediaId}`, {
                method: "POST",
                headers: {
                  "Authorization": `Basic ${authString}`,
                  "Content-Type": "application/json",
                  "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
                },
                body: JSON.stringify({ alt_text: imageAltText })
              }, 3, 1000, 15000).catch(e => {
                console.error("[WordPressClient] Non-blocking media rollback error:", e);
              });
            }
          } catch (e) {
            console.error("Failed to parse images description during rollback:", e);
          }
        }
      }

      const response = await this.fetchWithRetry(endpoint, {
        method: isWooCommerce ? "PUT" : "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/json",
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0"
        },
        body: JSON.stringify(payload)
      }, 3, 1000, 15000);

      if (!response.ok) {
        return { success: false, error: `Rollback rejected by WordPress server: HTTP status code ${response.status}` };
      }

      return { success: true };
    } catch (err: any) {
      console.error("[WordPressClient] Restore point execution failed:", err);
      return { success: false, error: err.message || "Network communication failure" };
    }
  }
};
