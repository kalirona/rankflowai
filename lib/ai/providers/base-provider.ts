// lib/ai/providers/base-provider.ts

export interface AIResponse {
  seoTitle: string;
  metaDesc: string;
  seoDesc: string;
  imageAltText: string;
}

export interface ProviderStats {
  id: string;
  name: string;
  isHealthy: boolean;
  latencyMs: number;
  lastChecked: string;
  successCount: number;
  failureCount: number;
}

export abstract class BaseAIProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly isSystem: boolean;

  abstract ping(): Promise<boolean>;
  abstract generateSEO(product: {
    name: string;
    description: string;
    shortDescription: string;
  }): Promise<AIResponse>;

  // Exponential backoff retry utility
  protected async withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        console.warn(`[AI Provider: ${this.name}] Retry ${i + 1}/${retries} failed:`, err);
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }
}
