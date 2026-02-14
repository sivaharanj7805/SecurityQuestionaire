import { retrieveContext, retrieveFromAnswerLibrary } from "./retrieve";
import { scoreConfidence, type ConfidenceLevel } from "./confidence";
import { getProvider, type ModelTier } from "@/lib/ai/providers";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts/answer-generator";
import { trackUsage } from "@/lib/ai/cost-tracker";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface AnswerResult {
  answer: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  sourceChunkIds: string[];
  tokensUsed: { input: number; output: number };
  cost: number;
  model: string;
  fromAnswerLibrary: boolean;
}

type AnswerFormat = "freetext" | "yes_no" | "multiple_choice";

function selectModel(answerFormat: AnswerFormat): ModelTier {
  // Use Haiku for simple yes/no; Sonnet for complex freetext
  if (answerFormat === "yes_no") return "haiku";
  return "sonnet";
}

async function getCompanyName(orgId: string): Promise<string> {
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId));

  return org?.name ?? "Our Company";
}

export async function generateAnswer(
  orgId: string,
  question: string,
  answerFormat: AnswerFormat = "freetext"
): Promise<AnswerResult> {
  // 1. Check answer library first (similarity > 0.85)
  const libraryMatch = await retrieveFromAnswerLibrary(orgId, question);

  if (libraryMatch) {
    const { level, reason } = scoreConfidence(
      libraryMatch.approvedAnswer,
      libraryMatch.similarity
    );

    return {
      answer: libraryMatch.approvedAnswer,
      confidence: level,
      confidenceReason: reason,
      sourceChunkIds: [],
      tokensUsed: { input: 0, output: 0 },
      cost: 0,
      model: "answer-library",
      fromAnswerLibrary: true,
    };
  }

  // 2. Retrieve context from knowledge base
  const contextChunks = await retrieveContext(orgId, question);

  if (contextChunks.length === 0) {
    return {
      answer: "INSUFFICIENT_CONTEXT: No relevant information was found in the knowledge base to answer this question.",
      confidence: "none",
      confidenceReason: "No relevant context found in knowledge base.",
      sourceChunkIds: [],
      tokensUsed: { input: 0, output: 0 },
      cost: 0,
      model: "none",
      fromAnswerLibrary: false,
    };
  }

  // 3. Build prompt
  const companyName = await getCompanyName(orgId);
  const systemPrompt = buildSystemPrompt(companyName);
  const userPrompt = buildUserPrompt(question, contextChunks);

  // 4. Route to appropriate model
  const modelTier = selectModel(answerFormat);
  const provider = getProvider(modelTier);

  // 5. Generate answer
  const result = await provider.generateAnswer(systemPrompt, userPrompt);

  // 6. Track usage
  await trackUsage(orgId, result);

  // 7. Score confidence
  const topSimilarity = contextChunks[0].similarity;
  const { level, reason } = scoreConfidence(result.answer, topSimilarity);

  return {
    answer: result.answer,
    confidence: level,
    confidenceReason: reason,
    sourceChunkIds: contextChunks.map((c) => c.chunkId),
    tokensUsed: {
      input: result.tokensUsed.input,
      output: result.tokensUsed.output,
    },
    cost: result.cost,
    model: result.model,
    fromAnswerLibrary: false,
  };
}
