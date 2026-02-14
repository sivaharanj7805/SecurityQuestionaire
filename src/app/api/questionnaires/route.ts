import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { questionnaires, questions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const list = await db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.orgId, orgId))
      .orderBy(desc(questionnaires.createdAt));

    return NextResponse.json(list);
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

    const [questionnaire] = await db
      .insert(questionnaires)
      .values({
        orgId,
        name,
        status: "draft",
        questionCount: questionData.length,
        completedCount: 0,
        createdBy: userId,
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
