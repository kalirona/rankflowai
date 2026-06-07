// lib/ai/providers/gemini-provider.ts

import { BaseAIProvider, AIResponse } from "./base-provider";
import { GoogleGenAI, Type } from "@google/genai";

export class GeminiProvider extends BaseAIProvider {
  readonly id: string;
  readonly name: string;
  readonly isSystem: boolean;
  private aiClient: GoogleGenAI;

  constructor(id: string, name: string, isSystem: boolean, apiKey: string) {
    super();
    this.id = id;
    this.name = name;
    this.isSystem = isSystem;
    this.aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "ping",
      });
      return true;
    } catch (err) {
      console.error(`[GeminiProvider ${this.id}] Ping failed:`, err);
      return false;
    }
  }

  async generateSEO(product: {
    name: string;
    description: string;
    shortDescription: string;
  }): Promise<AIResponse> {
    return this.withRetry(async () => {
      const prompt = `Perform dynamic elite SEO optimization for the following WooCommerce/WordPress product.
Product Description Parameters:
Product Name: "${product.name}"
Product Short Description: "${product.shortDescription || ""}"
Product Description: "${product.description || ""}"

Generate:
1. SEO optimized product title (short, punchy, keyword rich, professional). Do not insert markdown formatting or quotes.
2. SEO optimized product meta description (150-160 characters summary, click-worthy, no HTML, compact).
3. SEO optimized product long description (rich, compelling, clean typography, outline product specs in html format).
4. Generate a descriptive ALT text parameter that describes this product high-performance layout.

Analyze structural metrics and return a well-formed JSON object matching this schema.`;

      const aiResponse = await this.aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              seoTitle: { type: Type.STRING, description: "A high click-through rate HTML search title" },
              metaDesc: { type: Type.STRING, description: "Action-oriented marketing meta description (under 160 chars)" },
              seoDesc: { type: Type.STRING, description: "Premium marketing rich description copy in HTML" },
              imageAltText: { type: Type.STRING, description: "SEO optimization descriptive image alt tag text" }
            },
            required: ["seoTitle", "metaDesc", "seoDesc", "imageAltText"]
          }
        }
      });

      const resText = aiResponse.text || "{}";
      const resObj = JSON.parse(resText.trim());
      return {
        seoTitle: resObj.seoTitle || `${product.name} | Certified Premium Edition`,
        metaDesc: resObj.metaDesc || product.shortDescription || "Premium high-performance product edition.",
        seoDesc: resObj.seoDesc || product.description || "Premium certified product.",
        imageAltText: resObj.imageAltText || `Premium Close-up shot representing ${product.name}`,
      };
    });
  }
}
