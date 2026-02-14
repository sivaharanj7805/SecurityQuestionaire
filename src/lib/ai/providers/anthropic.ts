import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, GenerateOptions, GenerateResult } from "./types";

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheCreation: number }> = {
  "claude-sonnet-4-5-20250929": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    input: 1,
    output: 5,
    cacheRead: 0.1,
    cacheCreation: 1.25,
  },
};

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _client;
}

function calculateCost(
  model: string,
  tokens: { input: number; output: number; cacheRead?: number; cacheCreation?: number }
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;

  const inputCost = (tokens.input / 1_000_000) * pricing.input;
  const outputCost = (tokens.output / 1_000_000) * pricing.output;
  const cacheReadCost = ((tokens.cacheRead ?? 0) / 1_000_000) * pricing.cacheRead;
  const cacheCreationCost = ((tokens.cacheCreation ?? 0) / 1_000_000) * pricing.cacheCreation;

  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}

function createProvider(model: string): AIProvider {
  return {
    async generateAnswer(
      system: string,
      user: string,
      opts?: GenerateOptions
    ): Promise<GenerateResult> {
      const client = getClient();

      const response = await client.messages.create({
        model,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.2,
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: user,
          },
        ],
      });

      const answer = response.content
        .filter((block) => block.type === "text")
        .map((block) => {
          if (block.type === "text") return block.text;
          return "";
        })
        .join("");

      const usage = response.usage as unknown as Record<string, number>;
      const tokensUsed = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheCreation: usage.cache_creation_input_tokens ?? 0,
      };

      return {
        answer,
        tokensUsed,
        cost: calculateCost(model, tokensUsed),
        model,
      };
    },
  };
}

export const sonnetProvider = createProvider("claude-sonnet-4-5-20250929");
export const haikuProvider = createProvider("claude-haiku-4-5-20251001");
