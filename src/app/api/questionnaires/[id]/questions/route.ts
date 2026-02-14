import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { questions, questionnaires } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const questionList = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.questionnaireId, id),
          eq(questions.orgId, orgId)
        )
      )
      .orderBy(questions.createdAt);

    return NextResponse.json(questionList);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: questionnaireId } = await params;
    const body = await request.json();

    // Single question update
    if (body.questionId) {
      const { questionId, ...updates } = body;
      const allowedFields: Record<string, unknown> = {};

      if (updates.humanAnswer !== undefined) allowedFields.humanAnswer = updates.humanAnswer;
      if (updates.status !== undefined) allowedFields.status = updates.status;
      if (updates.aiAnswer !== undefined) allowedFields.aiAnswer = updates.aiAnswer;
      if (updates.confidence !== undefined) allowedFields.confidence = updates.confidence;

      allowedFields.updatedAt = new Date();

      await db
        .update(questions)
        .set(allowedFields)
        .where(
          and(
            eq(questions.id, questionId),
            eq(questions.questionnaireId, questionnaireId),
            eq(questions.orgId, orgId)
          )
        );

      return NextResponse.json({ success: true });
    }

    // Bulk update
    if (body.questionIds && body.status) {
      const { questionIds, status } = body as {
        questionIds: string[];
        status: string;
      };

      for (const qId of questionIds) {
        await db
          .update(questions)
          .set({ status: status as "draft" | "approved" | "rejected" | "skipped", updatedAt: new Date() })
          .where(
            and(
              eq(questions.id, qId),
              eq(questions.questionnaireId, questionnaireId),
              eq(questions.orgId, orgId)
            )
          );
      }

      // Update questionnaire status if all resolved
      const allQuestions = await db
        .select({ status: questions.status })
        .from(questions)
        .where(
          and(
            eq(questions.questionnaireId, questionnaireId),
            eq(questions.orgId, orgId)
          )
        );

      const allResolved = allQuestions.every(
        (q) => q.status === "approved" || q.status === "rejected" || q.status === "skipped"
      );

      if (allResolved && allQuestions.length > 0) {
        await db
          .update(questionnaires)
          .set({ status: "completed" })
          .where(eq(questionnaires.id, questionnaireId));
      }

      return NextResponse.json({
        success: true,
        updated: questionIds.length,
      });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error updating questions:", error);
    return NextResponse.json(
      { error: "Failed to update questions" },
      { status: 500 }
    );
  }
}
