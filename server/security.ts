// server/security.ts
import crypto from "crypto";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";
const DEFAULT_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DEFAULT_SECRET = "rankflow-ai-development-jwt-super-secret-key-123456";

// 1. Environment Variable Schema Validation
export const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ENCRYPTION_KEY: z.string()
    .length(64, "ENCRYPTION_KEY must be a 64-character hex string representing a 256-bit key"),
  JWT_SECRET: z.string().min(12),
});

let parsedEnv: z.infer<typeof EnvSchema>;
const rawKey = process.env.ENCRYPTION_KEY;
const rawSecret = process.env.JWT_SECRET;

if (isProd) {
  if (!rawKey || rawKey === DEFAULT_KEY) {
    throw new Error("FATAL: ENCRYPTION_KEY must be set to a unique 64-char hex string in production.");
  }
  if (!rawSecret || rawSecret === DEFAULT_SECRET) {
    throw new Error("FATAL: JWT_SECRET must be set to a unique strong secret in production.");
  }
  parsedEnv = EnvSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    APP_URL: process.env.APP_URL,
    ENCRYPTION_KEY: rawKey,
    JWT_SECRET: rawSecret,
  });
} else {
  parsedEnv = EnvSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    APP_URL: process.env.APP_URL,
    ENCRYPTION_KEY: rawKey || DEFAULT_KEY,
    JWT_SECRET: rawSecret || DEFAULT_SECRET,
  });
}

export const ENV = parsedEnv;

// 2. AES-256-GCM WordPress Password Protection
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;

/**
 * Encrypt a plain-text WordPress password safely using AES-256-GCM.
 * Output format: encryptedHex:ivHex:tagHex
 */
export function encryptWpPassword(plainText: string): string {
  if (!plainText.trim()) return "";
  
  // Key from hex string (32 bytes / 256 bits)
  const keyHex = ENV.ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, "hex");

  // Initialization vector - cryptographically random
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const tag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${encrypted}:${ivHex}:${tag}`;
}

/**
 * Decrypt a WordPress password encrypted using AES-256-GCM.
 */
export function decryptWpPassword(cipherWithMetadata: string): string {
  if (!cipherWithMetadata) return "";
  
  try {
    const parts = cipherWithMetadata.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid cipher metadata structure");
    }

    const [encryptedHex, ivHex, tagHex] = parts;
    
    const key = Buffer.from(ENV.ENCRYPTION_KEY, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("AES decryption failed. Verify ENCRYPTION_KEY integrity.", errMsg);
    throw new Error("Credentials decryption failed. Root cause key mismatch or tampered payload.");
  }
}

// 3. Simple input sanitization helper (preserving URL forward slashes)
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// 4. Enterprise-Grade SSRF Protection Function
import dns from "dns";
import { promisify } from "util";
const lookupAsync = promisify(dns.lookup);

export async function isSafeUrlForSsrf(urlString: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname;

    if (!hostname) return false;
    const lowerHost = hostname.toLowerCase();

    // Direct match static exclusions
    if (
      lowerHost === "localhost" ||
      lowerHost === "127.0.0.1" ||
      lowerHost === "::1" ||
      lowerHost.includes("metadata.google") ||
      lowerHost.includes("169.254.169.254") ||
      lowerHost.includes("instance-data") ||
      lowerHost.includes("metadata.internal")
    ) {
      return false;
    }

    // Dynamic DNS resolution check to prevent DNS rebinding or attacker-controlled private records
    const ips: string[] = [];
    try {
      const result = await lookupAsync(hostname, { all: true });
      if (Array.isArray(result)) {
        ips.push(...result.map(entry => entry.address));
      }
    } catch {
      ips.push(hostname);
    }

    for (const ip of ips) {
      if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") {
        return false;
      }
      
      const ipv4Parts = ip.split(".").map(Number);
      if (ipv4Parts.length === 4 && ipv4Parts.every(part => !isNaN(part))) {
        const [p1, p2, p3, p4] = ipv4Parts;
        // 10.0.0.0/8
        if (p1 === 10) return false;
        // 172.16.0.0/12
        if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
        // 192.168.0.0/16
        if (p1 === 192 && p2 === 168) return false;
        // 169.254.0.0/16 (Link local)
        if (p1 === 169 && p2 === 254) return false;
        // 127.0.0.0/8
        if (p1 === 127) return false;
        // 100.64.0.0/10
        if (p1 === 100 && p2 >= 64 && p2 <= 127) return false;
        // Multicast
        if (p1 >= 224 && p1 <= 239) return false;
      }
      
      const ipLower = ip.toLowerCase();
      if (
        ipLower.startsWith("fe80:") ||
        ipLower.startsWith("fc00:") ||
        ipLower.startsWith("fd00:") ||
        ipLower === "::1" ||
        ipLower === "::"
      ) {
        return false;
      }
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * A highly secure fetch wrapper that protects against SSRF (including redirect-based SSRF)
 * by verifying the IP address at every redirect hop.
 */
export async function safeFetch(url: string, options: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let currentUrl = url;
  let redirectCount = 0;
  
  // Make a shallow copy of options to avoid mutating user-supplied objects
  const fetchOptions: RequestInit = { ...options, redirect: "manual" };

  while (true) {
    if (!(await isSafeUrlForSsrf(currentUrl))) {
      throw new Error(`SSRF Blocked: URL resolved to public/private forbidden IP networks.`);
    }

    const response = await fetch(currentUrl, fetchOptions);

    if (response.status >= 300 && response.status < 400) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error("SSRF Blocked: Too many HTTP redirects.");
      }
      const location = response.headers.get("location");
      if (!location) {
        return response; // Return the redirection outcome directly if Location header is missing
      }
      // Resolve potential relative path redirects against the current URL context
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return response;
  }
}
