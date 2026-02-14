import { describe, it, expect } from "vitest";
import { parseQuestionnaire } from "@/lib/parsers/questionnaire";
import * as XLSX from "xlsx";

function createTestXlsx(headers: string[], rows: string[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("Questionnaire parser", () => {
  it("detects 'Question' column header", () => {
    const buf = createTestXlsx(
      ["Question", "Answer"],
      [["Do you have MFA?", "Yes"], ["Is data encrypted?", "Yes"]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(2);
    expect(result.questions[0].questionText).toBe("Do you have MFA?");
  });

  it("detects 'Requirement' column header", () => {
    const buf = createTestXlsx(
      ["Requirement", "Response"],
      [["Must implement encryption", ""]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(1);
  });

  it("detects 'Control' column header", () => {
    const buf = createTestXlsx(
      ["Control", "Description"],
      [["Access control policy implemented", ""]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(1);
  });

  it("detects yes/no format for 'Do you...' questions", () => {
    const buf = createTestXlsx(
      ["Question"],
      [["Do you have SOC 2 certification?"]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions[0].answerFormat).toBe("yes_no");
  });

  it("detects freetext format for 'Describe...' questions", () => {
    const buf = createTestXlsx(
      ["Question"],
      [["Describe your backup procedures."]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions[0].answerFormat).toBe("freetext");
  });

  it("skips questions shorter than 5 chars", () => {
    const buf = createTestXlsx(
      ["Question"],
      [["Hi"], ["Do you implement encryption at rest?"]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(1);
  });

  it("skips empty rows", () => {
    const buf = createTestXlsx(
      ["Question"],
      [["Do you have MFA?"], [""], ["Is data encrypted?"]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(2);
  });

  it("handles empty sheet (no questions)", () => {
    const buf = createTestXlsx(["Question"], []);
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(0);
  });

  it("handles case-insensitive headers", () => {
    const buf = createTestXlsx(
      ["QUESTION", "ANSWER"],
      [["Do you encrypt data?", "Yes"]]
    );
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(1);
  });

  it("handles multiple sheets", () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["Question"], ["Do you have MFA?"]
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Question"], ["Is data encrypted?"]
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, "Access Control");
    XLSX.utils.book_append_sheet(wb, ws2, "Encryption");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const result = parseQuestionnaire(buf);
    expect(result.questions.length).toBe(2);
  });

  it("returns totalCount matching questions array length", () => {
    const buf = createTestXlsx(
      ["Question"],
      [["Q1?"], ["Q2?"], ["Q3?"]]
    );
    // All questions > 5 chars would not work here since "Q1?" is only 3 chars
    // Let me use proper questions
    const buf2 = createTestXlsx(
      ["Question"],
      [
        ["Do you have MFA enabled?"],
        ["Is data encrypted at rest?"],
        ["Do you perform penetration testing?"],
      ]
    );
    const result = parseQuestionnaire(buf2);
    expect(result.totalCount).toBe(result.questions.length);
  });
});
