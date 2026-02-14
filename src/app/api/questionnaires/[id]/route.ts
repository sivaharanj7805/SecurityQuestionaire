import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { questionnaires, questions } from "@/lib/db/schema";
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
      .select()
      .from(questionnaires)
      .where(
        and(eq(questionnaires.id, id), eq(questionnaires.orgId, orgId))
      );

    if (!questionnaire) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(questionnaire);
  } catch (error) {
    console.error("Error fetching questionnaire:", error);
    return NextResponse.json(
      { error: "Failed to fetch questionnaire" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Delete questions + questionnaire in a transaction
    await db.transaction(async (tx) => {
      await tx
        .delete(questions)
        .where(
          and(
            eq(questions.questionnaireId, id),
            eq(questions.orgId, orgId)
          )
        );

      await tx
        .delete(questionnaires)
        .where(
          and(eq(questionnaires.id, id), eq(questionnaires.orgId, orgId))
        );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting questionnaire:", error);
    return NextResponse.json(
      { error: "Failed to delete questionnaire" },
      { status: 500 }
    );
  }
}
