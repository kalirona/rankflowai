// lib/ai/provider-manager.ts

import fs from "fs";
import path from "path";
import { BaseAIProvider, AIResponse, ProviderStats } from "./providers/base-provider";
import { GeminiProvider } from "./providers/gemini-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { encryptWpPassword, decryptWpPassword } from "../../server/security";

const SETTINGS_FILE_PATH = path.join(process.cwd(), "db_user_settings.json");

export interface UserAiConfig {
  activeProvider: string; // "gemini-system" | "openai-system" | "gemini-user" | "openai-user"
  userGeminiKeyEncrypted: string | null;
  userOpenaiKeyEncrypted: string | null;
}

// In-memory health status history
const healthRegistry: { [userId: string]: { [providerId: string]: ProviderStats } } = {};

function readAllConfigs(): Record<string, UserAiConfig> {
  if (fs.existsSync(SETTINGS_FILE_PATH)) {
    try {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
      return JSON.parse(data);
    } catch (err) {
      console.error("Failed to read user AI config file:", err);
    }
  }
  return {};
}

function writeAllConfigs(configs: Record<string, UserAiConfig>) {
  try {
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(configs, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save user AI config file:", err);
  }
}

export const AIProviderManager = {
  // 1. Get configuration for a user
  getUserConfig(userId: string): UserAiConfig {
    const configs = readAllConfigs();
    if (configs[userId]) {
      return configs[userId];
    }
    // Return standard system defaults if first onboarding
    return {
      activeProvider: "gemini-system",
      userGeminiKeyEncrypted: null,
      userOpenaiKeyEncrypted: null,
    };
  },

  // 2. Update and save AI configuration for a user
  saveUserConfig(userId: string, update: Partial<UserAiConfig>) {
    const configs = readAllConfigs();
    const current = configs[userId] || {
      activeProvider: "gemini-system",
      userGeminiKeyEncrypted: null,
      userOpenaiKeyEncrypted: null,
    };
    configs[userId] = {
      ...current,
      ...update,
    };
    writeAllConfigs(configs);
  },

  // 3. Helper to encrypt a raw credentials key using secure AES-256-GCM
  encryptKey(apiKey: string): string {
    return encryptWpPassword(apiKey);
  },

  // 4. Helper to decrypt a key
  decryptKey(encryptedKey: string): string {
    return decryptWpPassword(encryptedKey);
  },

  // 5. Build dynamic instance of a specific provider for a user
  getProvider(userId: string, providerId: string): BaseAIProvider | null {
    const config = this.getUserConfig(userId);

    if (providerId === "gemini-system") {
      const systemKey = process.env.GEMINI_API_KEY;
      if (!systemKey || systemKey === "MY_GEMINI_API_KEY") return null;
      return new GeminiProvider("gemini-system", "System Gemini Service", true, systemKey);
    }

    if (providerId === "openai-system") {
      const systemKey = process.env.OPENAI_API_KEY;
      if (!systemKey) return null;
      return new OpenAIProvider("openai-system", "System OpenAI Service", true, systemKey);
    }

    if (providerId === "gemini-user") {
      if (!config.userGeminiKeyEncrypted) return null;
      try {
        const rawKey = this.decryptKey(config.userGeminiKeyEncrypted);
        if (!rawKey) return null;
        return new GeminiProvider("gemini-user", "Personal Gemini Key", false, rawKey);
      } catch (err) {
        console.error("Decryption of personal Gemini API key failed:", err);
        return null;
      }
    }

    if (providerId === "openai-user") {
      if (!config.userOpenaiKeyEncrypted) return null;
      try {
        const rawKey = this.decryptKey(config.userOpenaiKeyEncrypted);
        if (!rawKey) return null;
        return new OpenAIProvider("openai-user", "Personal OpenAI Key", false, rawKey);
      } catch (err) {
        console.error("Decryption of personal OpenAI API key failed:", err);
        return null;
      }
    }

    return null;
  },

  // 6. Get stats Registry for a user
  getStats(userId: string): ProviderStats[] {
    if (!healthRegistry[userId]) {
      healthRegistry[userId] = {
        "gemini-system": {
          id: "gemini-system",
          name: "System Gemini Service",
          isHealthy: true,
          latencyMs: 0,
          lastChecked: "Never",
          successCount: 0,
          failureCount: 0,
        },
        "openai-system": {
          id: "openai-system",
          name: "System OpenAI Service",
          isHealthy: true,
          latencyMs: 0,
          lastChecked: "Never",
          successCount: 0,
          failureCount: 0,
        },
        "gemini-user": {
          id: "gemini-user",
          name: "Personal Gemini Key",
          isHealthy: false,
          latencyMs: 0,
          lastChecked: "Never",
          successCount: 0,
          failureCount: 0,
        },
        "openai-user": {
          id: "openai-user",
          name: "Personal OpenAI Key",
          isHealthy: false,
          latencyMs: 0,
          lastChecked: "Never",
          successCount: 0,
          failureCount: 0,
        },
      };
    }
    
    // Refresh health details of custom keys based on availability of encrypted secret
    const config = this.getUserConfig(userId);
    healthRegistry[userId]["gemini-user"].isHealthy = !!config.userGeminiKeyEncrypted;
    healthRegistry[userId]["openai-user"].isHealthy = !!config.userOpenaiKeyEncrypted;

    return Object.values(healthRegistry[userId]);
  },

  // 7. Track specific provider run feedback
  recordFeedback(userId: string, providerId: string, success: boolean, latency: number) {
    this.getStats(userId); // prime object initialization
    const stat = healthRegistry[userId][providerId];
    if (stat) {
      if (success) {
        stat.successCount += 1;
        stat.isHealthy = true;
      } else {
        stat.failureCount += 1;
        stat.isHealthy = false;
      }
      stat.latencyMs = latency;
      stat.lastChecked = new Date().toISOString();
    }
  },

  // 8. Single entry point for product SEO optimization featuring Automatic Failover & Status Tracking
  async generateSEO(
    userId: string,
    product: { name: string; description: string; shortDescription: string }
  ): Promise<{ response: AIResponse; usedProvider: string }> {
    const config = this.getUserConfig(userId);
    const preferredId = config.activeProvider;

    // Define priority list of fallback candidates under failover architecture
    const trialList = [
      preferredId,
      "gemini-system",
      "openai-system",
    ];

    // Filter duplicates
    const finalChain = Array.from(new Set(trialList));

    let lastError: any;
    for (const providerId of finalChain) {
      const provider = this.getProvider(userId, providerId);
      if (!provider) {
        console.warn(`[AI Failover Chain] Provider ${providerId} is unconfigured or unavailable, moving to next.`);
        continue;
      }

      const start = Date.now();
      try {
        console.log(`[AI Failover Chain] Relying on provider "${providerId}"...`);
        const result = await provider.generateSEO(product);
        const duration = Date.now() - start;

        // Record successful run
        this.recordFeedback(userId, providerId, true, duration);

        return {
          response: result,
          usedProvider: providerId,
        };
      } catch (err) {
        const duration = Date.now() - start;
        console.error(`[AI Failover Chain] Run failed with provider "${providerId}":`, err);
        this.recordFeedback(userId, providerId, false, duration);
        lastError = err;
      }
    }

    throw new Error(`[SaaS Core Error: AI Outage] All providers in the failover loop completed with failure. Last error: ${lastError?.message || "Unknown error"}`);
  },

  // 9. Manual health check ping routine
  async verifyProviderHealth(userId: string, providerId: string): Promise<boolean> {
    const provider = this.getProvider(userId, providerId);
    if (!provider) return false;

    const start = Date.now();
    const result = await provider.ping();
    const duration = Date.now() - start;

    this.recordFeedback(userId, providerId, result, duration);
    return result;
  },
};
