import * as XLSX from "xlsx";

interface ExportQuestion {
  section: string | null;
  questionText: string;
  answer: string;
  confidence: string;
  status: string;
}

export function generateExcelExport(
  questionnaireName: string,
  questions: ExportQuestion[]
): Buffer {
  const workbook = XLSX.utils.book_new();

  const rows = questions.map((q, idx) => ({
    "#": idx + 1,
    Section: q.section ?? "",
    Question: q.questionText,
    Answer: q.answer,
    Confidence: q.confidence.charAt(0).toUpperCase() + q.confidence.slice(1),
    Status: q.status.charAt(0).toUpperCase() + q.status.slice(1),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Style column widths
  worksheet["!cols"] = [
    { wch: 5 },   // #
    { wch: 20 },  // Section
    { wch: 60 },  // Question
    { wch: 80 },  // Answer
    { wch: 12 },  // Confidence
    { wch: 12 },  // Status
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Questionnaire");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return Buffer.from(buffer);
}
