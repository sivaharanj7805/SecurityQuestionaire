import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { documents, questionnaires, questions, answerLibrary } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [docCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.orgId, orgId));

    const [questionnaireCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questionnaires)
      .where(eq(questionnaires.orgId, orgId));

    const [answeredCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        and(
          eq(questions.orgId, orgId),
          eq(questions.status, "approved")
        )
      );

    const [libraryCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(answerLibrary)
      .where(eq(answerLibrary.orgId, orgId));

    return NextResponse.json({
      documents: docCount.count,
      questionnaires: questionnaireCount.count,
      questionsAnswered: answeredCount.count,
      libraryEntries: libraryCount.count,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
