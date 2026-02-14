import * as XLSX from "xlsx";

export interface ExtractedQuestion {
  section: string;
  questionText: string;
  answerFormat: "freetext" | "yes_no" | "multiple_choice";
  rowIndex: number;
}

export interface QuestionnaireParseResult {
  questions: ExtractedQuestion[];
  totalCount: number;
}

const QUESTION_HEADER_PATTERNS =
  /^(question|query|requirement|control|item|ask|topic|description|control\s*description|security\s*question)/i;

const ANSWER_HEADER_PATTERNS =
  /^(answer|response|reply|vendor\s*response|your\s*response|your\s*answer)/i;

const YES_NO_PATTERNS = [
  /^do you\b/i,
  /^does your\b/i,
  /^is your\b/i,
  /^is there\b/i,
  /^are there\b/i,
  /^are you\b/i,
  /^has your\b/i,
  /^have you\b/i,
  /^can you\b/i,
  /^will you\b/i,
  /^would you\b/i,
];

function guessAnswerFormat(
  questionText: string
): "freetext" | "yes_no" | "multiple_choice" {
  const trimmed = questionText.trim();
  for (const pattern of YES_NO_PATTERNS) {
    if (pattern.test(trimmed)) return "yes_no";
  }
  return "freetext";
}

function findHeaderRow(
  rows: Record<string, string>[]
): { questionCol: string; answerCol: string | null; headerIndex: number } | null {
  // The first row of jsonData is always the header in sheet_to_json,
  // but we check the keys (column headers) directly
  if (rows.length === 0) return null;

  const headers = Object.keys(rows[0]);
  let questionCol: string | null = null;
  let answerCol: string | null = null;

  for (const header of headers) {
    const trimmed = header.trim();
    if (!questionCol && QUESTION_HEADER_PATTERNS.test(trimmed)) {
      questionCol = header;
    }
    if (!answerCol && ANSWER_HEADER_PATTERNS.test(trimmed)) {
      answerCol = header;
    }
  }

  if (questionCol) {
    return { questionCol, answerCol, headerIndex: 0 };
  }
  return null;
}

export function parseQuestionnaire(buffer: Buffer): QuestionnaireParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const questions: ExtractedQuestion[] = [];
  let globalRowIndex = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(
      worksheet,
      { defval: "" }
    );

    if (jsonData.length === 0) continue;

    const detected = findHeaderRow(jsonData);
    if (!detected) {
      // Try treating all non-empty text cells as questions from the first text column
      const headers = Object.keys(jsonData[0]);
      if (headers.length > 0) {
        const firstCol = headers[0];
        for (const row of jsonData) {
          const text = String(row[firstCol] ?? "").trim();
          if (text && text.length > 10) {
            questions.push({
              section: sheetName,
              questionText: text,
              answerFormat: guessAnswerFormat(text),
              rowIndex: globalRowIndex++,
            });
          }
        }
      }
      continue;
    }

    for (const row of jsonData) {
      const questionText = String(row[detected.questionCol] ?? "").trim();
      if (!questionText || questionText.length < 5) continue;

      questions.push({
        section: sheetName,
        questionText,
        answerFormat: guessAnswerFormat(questionText),
        rowIndex: globalRowIndex++,
      });
    }
  }

  return {
    questions,
    totalCount: questions.length,
  };
}
