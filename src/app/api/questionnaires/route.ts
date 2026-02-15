import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { questionnaires, questions } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { enforceLimit, PlanLimitError } from "@/lib/billing/enforce";
import { resolveUserId } from "@/lib/users";

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));
    const offset = (page - 1) * pageSize;

    const [list, countResult] = await Promise.all([
      db
        .select()
        .from(questionnaires)
        .where(eq(questionnaires.orgId, orgId))
        .orderBy(desc(questionnaires.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(questionnaires)
        .where(eq(questionnaires.orgId, orgId)),
    ]);

    return NextResponse.json({
      data: list,
      total: countResult[0].count,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error fetching questionnaires:", error);
    return NextResponse.json(
      { error: "Failed to fetch questionnaires" },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  questions: z.array(
    z.object({
      section: z.string(),
      questionText: z.string().min(1),
      answerFormat: z.enum(["freetext", "yes_no", "multiple_choice"]),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, questions: questionData } = validation.data;

    // Enforce plan limits
    try {
      await enforceLimit(orgId, "questionnaires");
    } catch (error) {
      if (error instanceof PlanLimitError) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // Resolve Clerk userId to internal user UUID
    const internalUserId = await resolveUserId(userId);
    if (!internalUserId) {
      return NextResponse.json(
        { error: "User not found. Please complete onboarding first." },
        { status: 403 }
      );
    }

    const [questionnaire] = await db
      .insert(questionnaires)
      .values({
        orgId,
        name,
        status: "draft",
        questionCount: questionData.length,
        completedCount: 0,
        createdBy: internalUserId,
      })
      .returning();

    if (questionData.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < questionData.length; i += BATCH_SIZE) {
        const batch = questionData.slice(i, i + BATCH_SIZE);
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

    return NextResponse.json(questionnaire);
  } catch (error) {
    console.error("Error creating questionnaire:", error);
    return NextResponse.json(
      { error: "Failed to create questionnaire" },
      { status: 500 }
    );
  }
}
