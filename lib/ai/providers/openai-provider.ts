// lib/ai/providers/openai-provider.ts

import { BaseAIProvider, AIResponse } from "./base-provider";
import OpenAI from "openai";

export class OpenAIProvider extends BaseAIProvider {
  readonly id: string;
  readonly name: string;
  readonly isSystem: boolean;
  private openai: OpenAI;

  constructor(id: string, name: string, isSystem: boolean, apiKey: string) {
    super();
    this.id = id;
    this.name = name;
    this.isSystem = isSystem;
    this.openai = new OpenAI({ apiKey });
  }

  async ping(): Promise<boolean> {
    try {
      await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      });
      return true;
    } catch (err) {
      console.error(`[OpenAIProvider ${this.id}] Ping failed:`, err);
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

Analyze structural metrics and return a well-formed JSON object matching this schema.
Schema:
{
  "seoTitle": "A high click-through rate HTML search title",
  "metaDesc": "Action-oriented marketing meta description (under 160 chars)",
  "seoDesc": "Premium marketing rich description copy in html format",
  "imageAltText": "SEO optimization descriptive image alt tag text"
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const resText = response.choices[0]?.message?.content || "{}";
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
