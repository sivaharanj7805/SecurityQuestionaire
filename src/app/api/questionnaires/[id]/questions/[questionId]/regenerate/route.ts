import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateAnswer } from "@/lib/rag/generate";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit("regenerate", orgId);
    if (rateLimit && !rateLimit.success) {
      return NextResponse.json(
        { error: "Too many regeneration requests. Please wait." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const { id: questionnaireId, questionId } = await params;

    // Verify question exists and belongs to this org + questionnaire
    const [question] = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.id, questionId),
          eq(questions.questionnaireId, questionnaireId),
          eq(questions.orgId, orgId)
        )
      );

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Generate a new answer
    const result = await generateAnswer(
      orgId,
      question.questionText,
      question.answerFormat as "freetext" | "yes_no" | "multiple_choice"
    );

    // Update the question with the new answer
    await db
      .update(questions)
      .set({
        aiAnswer: result.answer,
        confidence: result.confidence,
        sourceChunkIds: result.sourceChunkIds,
        status: "draft",
        humanAnswer: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(questions.id, questionId),
          eq(questions.orgId, orgId)
        )
      );

    return NextResponse.json({
      success: true,
      answer: result.answer,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate answer" },
      { status: 500 }
    );
  }
}
