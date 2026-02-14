import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions, questionnaires } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateAnswer } from "@/lib/rag/generate";

const processSchema = z.object({
  questionnaireId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = processSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { questionnaireId } = validation.data;

    // Verify questionnaire exists and belongs to org
    const [questionnaire] = await db
      .select()
      .from(questionnaires)
      .where(
        and(
          eq(questionnaires.id, questionnaireId),
          eq(questionnaires.orgId, orgId)
        )
      );

    if (!questionnaire) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    // Set status to processing
    await db
      .update(questionnaires)
      .set({ status: "processing", completedCount: 0 })
      .where(and(eq(questionnaires.id, questionnaireId), eq(questionnaires.orgId, orgId)));

    // Get all questions
    const questionList = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.questionnaireId, questionnaireId),
          eq(questions.orgId, orgId)
        )
      );

    // Process in background — return immediately
    processQuestions(orgId, questionnaireId, questionList).catch((err) => {
      console.error(`Batch processing failed for ${questionnaireId}:`, err);
    });

    return NextResponse.json({
      success: true,
      total: questionList.length,
      message: "Processing started",
    });
  } catch (error) {
    console.error("Process error:", error);
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}

interface QuestionRecord {
  id: string;
  questionText: string;
  answerFormat: "freetext" | "yes_no" | "multiple_choice";
}

async function processQuestions(
  orgId: string,
  questionnaireId: string,
  questionList: QuestionRecord[]
) {
  let completed = 0;
  let totalCost = 0;

  for (const question of questionList) {
    try {
      const result = await generateAnswer(
        orgId,
        question.questionText,
        question.answerFormat
      );

      await db
        .update(questions)
        .set({
          aiAnswer: result.answer,
          confidence: result.confidence,
          sourceChunkIds: result.sourceChunkIds,
          status: "draft",
          updatedAt: new Date(),
        })
        .where(and(eq(questions.id, question.id), eq(questions.orgId, orgId)));

      totalCost += result.cost;
    } catch (err) {
      console.error(
        `Failed to process question ${question.id}:`,
        err
      );

      // Don't fail the entire batch
      await db
        .update(questions)
        .set({
          aiAnswer: "Error: Failed to generate answer for this question.",
          confidence: "none",
          status: "draft",
          updatedAt: new Date(),
        })
        .where(and(eq(questions.id, question.id), eq(questions.orgId, orgId)));
    }

    completed++;

    // Update progress
    await db
      .update(questionnaires)
      .set({ completedCount: completed })
      .where(and(eq(questionnaires.id, questionnaireId), eq(questionnaires.orgId, orgId)));
  }

  // Mark questionnaire as draft (ready for review)
  await db
    .update(questionnaires)
    .set({
      status: "draft",
      completedCount: completed,
    })
    .where(and(eq(questionnaires.id, questionnaireId), eq(questionnaires.orgId, orgId)));
}
