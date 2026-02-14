/**
 * Sanitize text before including in AI prompts to defend against prompt injection.
 * Strips common injection patterns while preserving legitimate content.
 */

const INJECTION_PATTERNS: RegExp[] = [
  // Role override attempts
  /you are now\b/gi,
  /ignore (?:all )?(?:previous|prior|above) (?:instructions|rules|prompts?)/gi,
  /disregard (?:all )?(?:previous|prior|above) (?:instructions|rules|prompts?)/gi,
  /forget (?:all )?(?:previous|prior|above) (?:instructions|rules|prompts?)/gi,
  // System prompt injection
  /^system:\s*/gim,
  /```system\b/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<system>/gi,
  /<\/system>/gi,
  /<assistant>/gi,
  /<\/assistant>/gi,
  /<user>/gi,
  /<\/user>/gi,
  // Prompt override attempts
  /\bIMPORTANT:\s*(?:ignore|override|disregard)/gi,
  /\bCRITICAL:\s*(?:ignore|override|disregard|new instructions)/gi,
  /\bnew instructions:/gi,
  /\boverride (?:system|instructions|rules)/gi,
  // Jailbreak patterns
  /\bDAN\s*mode/gi,
  /\bdo anything now/gi,
  /\bact as (?:if you|an? )/gi,
  /\bpretend (?:you are|to be)/gi,
];

export function sanitizeForAI(text: string): string {
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[FILTERED]");
  }
  return sanitized;
}

/**
 * Truncate text to a maximum number of characters to prevent
 * context window overflow or excessive embedding costs.
 */
export function truncateForEmbedding(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
