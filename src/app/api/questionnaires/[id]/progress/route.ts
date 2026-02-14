import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { questionnaires } from "@/lib/db/schema";
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

    const [questionnaire] = await db
      .select({
        status: questionnaires.status,
        questionCount: questionnaires.questionCount,
        completedCount: questionnaires.completedCount,
      })
      .from(questionnaires)
      .where(
        and(
          eq(questionnaires.id, id),
          eq(questionnaires.orgId, orgId)
        )
      );

    if (!questionnaire) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      total: questionnaire.questionCount ?? 0,
      completed: questionnaire.completedCount,
      status: questionnaire.status,
    });
  } catch (error) {
    console.error("Progress error:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}
