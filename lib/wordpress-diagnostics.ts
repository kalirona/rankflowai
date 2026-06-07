// lib/wordpress-diagnostics.ts

import fs from "fs";
import path from "path";
import { isSafeUrlForSsrf, safeFetch } from "../server/security";

const DIAGNOSTICS_FILE_PATH = path.join(process.cwd(), "db_diagnostics_history.json");

export interface DiagnosticCheckResult {
  checkId: string;
  name: string;
  passed: boolean;
  recommendation: string;
}

export interface DiagnosticRun {
  id: string;
  siteUrl: string;
  timestamp: string;
  overallSuccess: boolean;
  results: DiagnosticCheckResult[];
}

function loadHistory(): Record<string, DiagnosticRun[]> {
  if (fs.existsSync(DIAGNOSTICS_FILE_PATH)) {
    try {
      const data = fs.readFileSync(DIAGNOSTICS_FILE_PATH, "utf-8");
      return JSON.parse(data);
    } catch (err) {
      console.error("Failed to load diagnostics history:", err);
    }
  }
  return {};
}

function saveHistory(history: Record<string, DiagnosticRun[]>) {
  try {
    fs.writeFileSync(DIAGNOSTICS_FILE_PATH, JSON.stringify(history, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write diagnostics history:", err);
  }
}

export const WordPressDiagnostics = {
  // 1. Fetch site history checks
  getHistory(siteUrl: string): DiagnosticRun[] {
    const cleanUrl = siteUrl.toLowerCase().replace(/\/+$/, "");
    const history = loadHistory();
    return history[cleanUrl] || [];
  },

  // 2. Clear site check history
  clearHistory(siteUrl: string): void {
    const cleanUrl = siteUrl.toLowerCase().replace(/\/+$/, "");
    const history = loadHistory();
    delete history[cleanUrl];
    saveHistory(history);
  },

  // 3. Dynamic diagnostics probe execution
  async executeProbe(siteUrl: string, username?: string, appPassword?: string): Promise<DiagnosticRun> {
    const cleanUrl = siteUrl.toLowerCase().replace(/\/+$/, "");

    // Validation checks status checklist
    const results: DiagnosticCheckResult[] = [
      {
        checkId: "wp_rest_api",
        name: "WordPress REST API Reachable",
        passed: false,
        recommendation: "Ensure WordPress is online, the URL is correct, and /wp-json endpoint returns JSON.",
      },
      {
        checkId: "woocommerce",
        name: "WooCommerce Installed & Enabled",
        passed: false,
        recommendation: "Install the WooCommerce plugin on your WordPress site and make sure it is activated.",
      },
      {
        checkId: "app_passwords",
        name: "Application Passwords Support",
        passed: false,
        recommendation: "Make sure Application Passwords are enabled under Users > Profile. Check if you are on HTTPS.",
      },
      {
        checkId: "permalinks",
        name: "Permalinks Enabled",
        passed: false,
        recommendation: "Go to Settings > Permalinks and set them to anything other than 'Plain' (e.g., 'Post name').",
      },
      {
        checkId: "rankflow_bridge",
        name: "RankFlow Bridge Installed",
        passed: false,
        recommendation: "Download and install our companion RankFlow Bridge plugin to optimize backend REST performance.",
      },
      {
        checkId: "yoast_seo",
        name: "Yoast SEO Active",
        passed: false,
        recommendation: "Optional but recommended: Install Yoast SEO to enable premium structural metadata optimization.",
      },
      {
        checkId: "rankmath",
        name: "RankMath SEO Active",
        passed: false,
        recommendation: "Optional: Install RankMath SEO if you prefer its rich schemas for syncing product metadata.",
      },
      {
        checkId: "firewall",
        name: "Firewall Access Allowed",
        passed: true, // Optimistically true, updated on network blocks
        recommendation: "Ensure security plugins like Wordfence or Sucuri do not block automation requests from our agent.",
      },
      {
        checkId: "cloudflare",
        name: "Cloudflare Blocks Checked",
        passed: true, // Updated on CF headers scan
        recommendation: "Configure a custom Cloudflare WAF skip rule for RankFlow IP blocks or disable Bot Fight Mode for REST routes.",
      },
    ];

    if (!(await isSafeUrlForSsrf(cleanUrl))) {
      results[0].passed = false;
      results[0].recommendation = "SSRF security check failed. Private and local IP structures are blocked.";
      return {
        id: `diag_${Math.random().toString(36).substring(2, 11)}`,
        siteUrl: cleanUrl,
        timestamp: new Date().toISOString(),
        overallSuccess: false,
        results,
      };
    }

    try {
      const authHeader: any = {};
      if (username && appPassword) {
        const authBase64 = Buffer.from(`${username}:${appPassword}`).toString("base64");
        authHeader["Authorization"] = `Basic ${authBase64}`;
      }

      // Probing REST entry point
      const start = Date.now();
      const response = await safeFetch(`${cleanUrl}/wp-json`, {
        method: "GET",
        headers: {
          ...authHeader,
          "User-Agent": "RankFlow-AI-SaaS-Connector/1.0",
        },
      });

      const headers = response.headers;
      const isCloudflare = headers.get("server")?.toLowerCase().includes("cloudflare") || 
                          headers.has("cf-ray") || 
                          headers.has("cf-cache-status");

      // Verify Cloudflare/Firewall status
      if (isCloudflare) {
        // If Cloudflare returns a blocking state (403, 503, or rate-limited)
        if (response.status === 403 || response.status === 503 || response.status === 429) {
          results.find(r => r.checkId === "cloudflare")!.passed = false;
          results.find(r => r.checkId === "cloudflare")!.recommendation = "Cloudflare security block met. Add a WAF exception.";
        }
      }

      // Check specific WAF/Firewall blockers
      if (response.status === 403) {
        results.find(r => r.checkId === "firewall")!.passed = false;
        results.find(r => r.checkId === "firewall")!.recommendation = "Server blocked the request with a 403 Forbidden. Disable active server firewalls.";
      }

      if (response.ok) {
        results.find(r => r.checkId === "wp_rest_api")!.passed = true;
        
        // Since wp-json succeeds, permalinks must be active (otherwise returns 404/plaintext route match error)
        results.find(r => r.checkId === "permalinks")!.passed = true;

        const body = await response.json();
        const namespaces: string[] = body.namespaces || [];

        // WooCommerce installed probe
        if (namespaces.includes("wc/v3") || namespaces.includes("wc/v2")) {
          results.find(r => r.checkId === "woocommerce")!.passed = true;
        }

        // Companion bridge installed probe
        if (namespaces.some(n => n.includes("rankflow"))) {
          results.find(r => r.checkId === "rankflow_bridge")!.passed = true;
        }

        // Yoast SEO probe
        if (namespaces.some(n => n.includes("yoast"))) {
          results.find(r => r.checkId === "yoast_seo")!.passed = true;
        }

        // RankMath SEO probe
        if (namespaces.some(n => n.includes("rankmath"))) {
          results.find(r => r.checkId === "rankmath")!.passed = true;
        }

        // Application Passwords probe
        if (username && appPassword) {
          const authResponse = await safeFetch(`${cleanUrl}/wp-json/wp/v2/users/me`, {
            method: "GET",
            headers: {
              ...authHeader,
              "User-Agent": "RankFlow-AI-SaaS-Connector/1.0",
            },
          });
          if (authResponse.ok || authResponse.status === 401) {
            results.find(r => r.checkId === "app_passwords")!.passed = true;
          }
        } else {
          // If no credentials supplied yet, check rest routes description or assume OK for API route definitions
          const routes = Object.keys(body.routes || {});
          if (routes.some(r => r.includes("users"))) {
            results.find(r => r.checkId === "app_passwords")!.passed = true;
          }
        }
      } else if (response.status === 404) {
        // Plain URL reachable but /wp-json yields 404. Let's probe if custom index.php?rest_route=/ query string gets a response!
        try {
          const fallbackRes = await safeFetch(`${cleanUrl}/index.php?rest_route=/`, {
            method: "GET",
            headers: {
              ...authHeader,
              "User-Agent": "RankFlow-AI-SaaS-Connector/1.0",
            },
          });
          if (fallbackRes.ok) {
            results.find(r => r.checkId === "wp_rest_api")!.passed = true;
            results.find(r => r.checkId === "permalinks")!.passed = false;
            results.find(r => r.checkId === "permalinks")!.recommendation = "REST API namespace active, but using plain query format (index.php?rest_route=/). Switch WordPress Permalinks in Settings -> Permalinks to 'Post name' to activate beautiful, clean /wp-json URIs.";
          } else {
            results.find(r => r.checkId === "wp_rest_api")!.passed = false;
            results.find(r => r.checkId === "permalinks")!.passed = false;
            results.find(r => r.checkId === "wp_rest_api")!.recommendation = "WordPress REST endpoint not found (404). This indicates a non-standard theme, customized endpoint, or a routing block. Confirm WP-REST API permissions.";
          }
        } catch (fbErr) {
          results.find(r => r.checkId === "wp_rest_api")!.passed = false;
          results.find(r => r.checkId === "permalinks")!.passed = false;
          results.find(r => r.checkId === "wp_rest_api")!.recommendation = "WordPress REST API returned a 404. Failed to connect via standard clean URI or plain query fallback.";
        }
      }

    } catch (err: any) {
      console.error(`[WordPressDiagnostics] Probe exception for ${cleanUrl}:`, err);
      // Fail API reachability
      results.find(r => r.checkId === "wp_rest_api")!.passed = false;
      results.find(r => r.checkId === "wp_rest_api")!.recommendation = `API Connection aborted: ${err.message || "Target site unreachable"}`;
    }

    // Evaluate overall diagnostic wellness
    // Critical checks that MUST pass represent the reachability of WordPress
    const criticalChecks = ["wp_rest_api", "permalinks"];
    const overallSuccess = criticalChecks.every(checkId => results.find(r => r.checkId === checkId)?.passed);

    const diagnosticResult: DiagnosticRun = {
      id: `diag_${Math.random().toString(36).substring(2, 11)}`,
      siteUrl: cleanUrl,
      timestamp: new Date().toISOString(),
      overallSuccess,
      results,
    };

    // Save check in histories registry
    const history = loadHistory();
    if (!history[cleanUrl]) {
      history[cleanUrl] = [];
    }
    history[cleanUrl].unshift(diagnosticResult);
    // Limit to storing the last 15 diagnostics to keep the storage clean and balanced
    if (history[cleanUrl].length > 15) {
      history[cleanUrl] = history[cleanUrl].slice(0, 15);
    }
    saveHistory(history);

    return diagnosticResult;
  },
};
