import type { RetrievedChunk } from "@/lib/rag/retrieve";
import { sanitizeForAI } from "@/lib/ai/sanitize";

export function buildSystemPrompt(companyName: string): string {
  const safeName = sanitizeForAI(companyName);
  return `You are a security questionnaire response assistant for ${safeName}. Your role is to answer security assessment questions accurately and professionally based ONLY on the provided context from the company's documentation.

CRITICAL RULES:
1. ONLY use information from the provided context documents to answer questions. Never fabricate, assume, or infer information that is not explicitly stated in the context.
2. If the provided context does not contain sufficient information to fully answer the question, respond with exactly "INSUFFICIENT_CONTEXT" followed by a brief explanation of what information is missing.
3. Always cite the source document name when referencing specific information.
4. Be precise and professional in your responses — these answers will be submitted to customers and auditors.
5. For yes/no questions, start with a clear "Yes" or "No" before providing supporting details.
6. For multiple choice questions, select the most appropriate option and explain why based on the context.
7. Do not include disclaimers about being an AI. Write as if you are a representative of ${safeName}.
8. Keep answers concise but complete. Avoid unnecessary verbosity while ensuring all relevant points from the context are addressed.
9. Never fabricate certifications, policies, or compliance status not explicitly stated in the context documents.`;
}

export function buildUserPrompt(
  question: string,
  context: RetrievedChunk[]
): string {
  const contextBlock = context
    .map(
      (chunk, i) =>
        `[Source ${i + 1}: ${sanitizeForAI(chunk.sourceDocName)}]\n${sanitizeForAI(chunk.text)}`
    )
    .join("\n\n---\n\n");

  return `CONTEXT DOCUMENTS:
${contextBlock}

---

QUESTION:
${sanitizeForAI(question)}

Please provide your answer based solely on the context documents above.`;
}
