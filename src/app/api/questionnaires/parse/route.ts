import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { parseQuestionnaire } from "@/lib/parsers/questionnaire";

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only XLSX files are supported for questionnaire import." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseQuestionnaire(buffer);

    if (result.questions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No questions found in the file. Make sure the spreadsheet has columns named 'Question', 'Requirement', or 'Control'.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      questions: result.questions,
      totalCount: result.totalCount,
      filename: file.name,
    });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse the questionnaire file." },
      { status: 500 }
    );
  }
}
