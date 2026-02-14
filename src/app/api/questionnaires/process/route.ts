import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions, questionnaires } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generateAnswer } from "@/lib/rag/generate";

const BATCH_SIZE = 10;

const processSchema = z.object({
  questionnaireId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add Upstash Redis rate limiting here (5 req/min per org)

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

    // Get unprocessed questions (aiAnswer is null)
    const unprocessedQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.questionnaireId, questionnaireId),
          eq(questions.orgId, orgId),
          isNull(questions.aiAnswer)
        )
      )
      .limit(BATCH_SIZE);

    // Get total counts for progress tracking
    const allQuestions = await db
      .select({ id: questions.id, aiAnswer: questions.aiAnswer })
      .from(questions)
      .where(
        and(
          eq(questions.questionnaireId, questionnaireId),
          eq(questions.orgId, orgId)
        )
      );

    const total = allQuestions.length;
    const alreadyProcessed = allQuestions.filter((q) => q.aiAnswer !== null).length;

    // If this is the first batch, set status to processing
    if (questionnaire.status !== "processing" && unprocessedQuestions.length > 0) {
      await db
        .update(questionnaires)
        .set({ status: "processing", completedCount: alreadyProcessed })
        .where(and(eq(questionnaires.id, questionnaireId), eq(questionnaires.orgId, orgId)));
    }

    // If nothing left to process, mark as complete
    if (unprocessedQuestions.length === 0) {
      await db
        .update(questionnaires)
        .set({ status: "draft", completedCount: total })
        .where(and(eq(questionnaires.id, questionnaireId), eq(questionnaires.orgId, orgId)));

      return NextResponse.json({
        success: true,
        processed: 0,
        completed: total,
        total,
        done: true,
      });
    }

    // Process this batch synchronously
    let batchProcessed = 0;
    for (const question of unprocessedQuestions) {
      try {
        const result = await generateAnswer(
          orgId,
          question.questionText,
          question.answerFormat as "freetext" | "yes_no" | "multiple_choice"
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
      } catch (err) {
        console.error(`Failed to process question ${question.id}:`, err);

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

      batchProcessed++;

      // Update progress counter
      await db
        .update(questionnaires)
        .set({ completedCount: alreadyProcessed + batchProcessed })
        .where(and(eq(questionnaires.id, questionnaireId), eq(questionnaires.orgId, orgId)));
    }

    const newCompleted = alreadyProcessed + batchProcessed;
    const done = newCompleted >= total;

    // If all questions processed, mark questionnaire as draft (ready for review)
    if (done) {
      await db
        .update(questionnaires)
        .set({ status: "draft", completedCount: total })
        .where(and(eq(questionnaires.id, questionnaireId), eq(questionnaires.orgId, orgId)));
    }

    return NextResponse.json({
      success: true,
      processed: batchProcessed,
      completed: newCompleted,
      total,
      done,
    });
  } catch (error) {
    console.error("Process error:", error);
    return NextResponse.json(
      { error: "Failed to process questions" },
      { status: 500 }
    );
  }
}
