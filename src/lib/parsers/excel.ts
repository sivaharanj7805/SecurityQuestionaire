import * as XLSX from "xlsx";

interface ExcelSheet {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  rawText: string;
}

interface ExcelParseResult {
  sheets: ExcelSheet[];
  rawText: string;
  qaRows: { question: string; answer: string }[];
}

const QA_HEADER_PATTERNS = {
  question: /^(question|query|requirement|control|item|ask|topic)/i,
  answer: /^(answer|response|reply|description|detail|comment|note)/i,
};

function detectQAColumns(
  headers: string[]
): { questionCol: string; answerCol: string } | null {
  let questionCol: string | null = null;
  let answerCol: string | null = null;

  for (const header of headers) {
    if (!questionCol && QA_HEADER_PATTERNS.question.test(header.trim())) {
      questionCol = header;
    }
    if (!answerCol && QA_HEADER_PATTERNS.answer.test(header.trim())) {
      answerCol = header;
    }
  }

  if (questionCol && answerCol) {
    return { questionCol, answerCol };
  }
  return null;
}

export function parseExcel(buffer: Buffer): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheets: ExcelSheet[] = [];
  const allText: string[] = [];
  const qaRows: { question: string; answer: string }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(
      worksheet,
      { defval: "" }
    );

    if (jsonData.length === 0) continue;

    const headers = Object.keys(jsonData[0]);
    const sheetText = XLSX.utils.sheet_to_csv(worksheet);

    sheets.push({
      name: sheetName,
      headers,
      rows: jsonData,
      rawText: sheetText,
    });

    allText.push(`--- Sheet: ${sheetName} ---`);
    allText.push(sheetText);

    const qaCols = detectQAColumns(headers);
    if (qaCols) {
      for (const row of jsonData) {
        const question = String(row[qaCols.questionCol] ?? "").trim();
        const answer = String(row[qaCols.answerCol] ?? "").trim();
        if (question) {
          qaRows.push({ question, answer });
        }
      }
    }
  }

  return {
    sheets,
    rawText: allText.join("\n"),
    qaRows,
  };
}
