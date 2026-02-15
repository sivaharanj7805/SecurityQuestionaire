"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { questionnaires, questions } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { resolveUserId } from "@/lib/users";

export async function createQuestionnaire(data: {
  name: string;
  sourceFileKey?: string;
  questionCount?: number;
  questions: {
    section: string;
    questionText: string;
    answerFormat: "freetext" | "yes_no" | "multiple_choice";
  }[];
}) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const internalUserId = await resolveUserId(userId);
  if (!internalUserId) throw new Error("User not found. Please complete onboarding first.");

  const [questionnaire] = await db
    .insert(questionnaires)
    .values({
      orgId,
      name: data.name,
      sourceFileKey: data.sourceFileKey ?? null,
      status: "draft",
      questionCount: data.questions.length,
      completedCount: 0,
      createdBy: internalUserId,
    })
    .returning();

  if (data.questions.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < data.questions.length; i += BATCH_SIZE) {
      const batch = data.questions.slice(i, i + BATCH_SIZE);
      await db.insert(questions).values(
        batch.map((q) => ({
          questionnaireId: questionnaire.id,
          orgId,
          section: q.section || null,
          questionText: q.questionText,
          answerFormat: q.answerFormat,
        }))
      );
    }
  }

  return questionnaire;
}

export async function getQuestionnaires() {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  return db
    .select()
    .from(questionnaires)
    .where(eq(questionnaires.orgId, orgId))
    .orderBy(desc(questionnaires.createdAt));
}

export async function getQuestionnaire(questionnaireId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  const [questionnaire] = await db
    .select()
    .from(questionnaires)
    .where(
      and(
        eq(questionnaires.id, questionnaireId),
        eq(questionnaires.orgId, orgId)
      )
    );

  return questionnaire ?? null;
}

export async function getQuestionnaireQuestions(
  questionnaireId: string,
  page = 1,
  pageSize = 50
) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  const offset = (page - 1) * pageSize;

  const [questionList, totalResult] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.questionnaireId, questionnaireId),
          eq(questions.orgId, orgId)
        )
      )
      .orderBy(questions.createdAt)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(questions)
      .where(
        and(
          eq(questions.questionnaireId, questionnaireId),
          eq(questions.orgId, orgId)
        )
      ),
  ]);

  return {
    questions: questionList,
    total: totalResult[0].count,
    page,
    pageSize,
    totalPages: Math.ceil(totalResult[0].count / pageSize),
  };
}

export async function deleteQuestionnaire(questionnaireId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  // Delete questions + questionnaire in a transaction
  await db.transaction(async (tx) => {
    await tx
      .delete(questions)
      .where(
        and(
          eq(questions.questionnaireId, questionnaireId),
          eq(questions.orgId, orgId)
        )
      );

    await tx
      .delete(questionnaires)
      .where(
        and(
          eq(questionnaires.id, questionnaireId),
          eq(questionnaires.orgId, orgId)
        )
      );
  });

  return { success: true };
}
