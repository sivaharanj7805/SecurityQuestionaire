import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { questions, questionnaires } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateExcelExport } from "@/lib/export/excel-export";
import { generateWordExport } from "@/lib/export/word-export";
import { logAudit } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "xlsx";

    if (format !== "xlsx" && format !== "docx") {
      return NextResponse.json(
        { error: "Invalid format. Use xlsx or docx." },
        { status: 400 }
      );
    }

    // Fetch questionnaire
    const [questionnaire] = await db
      .select()
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

    // Fetch all questions
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

    // Validate all questions are resolved (not draft or rejected without replacement)
    const unresolvedQuestions = questionList.filter(
      (q) => q.status === "draft" || q.status === "rejected"
    );

    if (unresolvedQuestions.length > 0) {
      const draftCount = unresolvedQuestions.filter((q) => q.status === "draft").length;
      const rejectedCount = unresolvedQuestions.filter((q) => q.status === "rejected").length;
      const parts: string[] = [];
      if (draftCount > 0) parts.push(`${draftCount} in draft`);
      if (rejectedCount > 0) parts.push(`${rejectedCount} rejected`);
      return NextResponse.json(
        {
          error: `Cannot export: ${parts.join(" and ")} question(s) need review. Please approve or skip all questions before exporting.`,
        },
        { status: 400 }
      );
    }

    // Map questions to export format (skipped questions get N/A answer)
    const exportQuestions = questionList.map((q) => ({
      section: q.section,
      questionText: q.questionText,
      answer: q.status === "skipped" ? "N/A" : (q.humanAnswer ?? q.aiAnswer ?? ""),
      confidence: q.confidence,
      status: q.status,
    }));

    let fileBuffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    if (format === "xlsx") {
      fileBuffer = generateExcelExport(questionnaire.name, exportQuestions);
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      fileExtension = "xlsx";
    } else {
      fileBuffer = await generateWordExport(
        questionnaire.name,
        exportQuestions
      );
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      fileExtension = "docx";
    }

    // Update questionnaire status to exported
    await db
      .update(questionnaires)
      .set({ status: "exported" })
      .where(and(eq(questionnaires.id, id), eq(questionnaires.orgId, orgId)));

    await logAudit({
      orgId,
      action: "questionnaire_exported",
      resourceType: "questionnaire",
      resourceId: id,
      details: { format, questionCount: questionList.length },
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const safeFilename = questionnaire.name
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "_");

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}_${dateStr}.${fileExtension}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error exporting questionnaire:", error);
    return NextResponse.json(
      { error: "Failed to export questionnaire" },
      { status: 500 }
    );
  }
}
