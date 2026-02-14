import type { AIProvider } from "./types";
import { sonnetProvider, haikuProvider } from "./anthropic";

export type ModelTier = "sonnet" | "haiku";

export function getProvider(tier: ModelTier): AIProvider {
  switch (tier) {
    case "sonnet":
      return sonnetProvider;
    case "haiku":
      return haikuProvider;
    default:
      throw new Error(`Unknown model tier: ${tier}`);
  }
}

export type { AIProvider, GenerateOptions, GenerateResult } from "./types";
