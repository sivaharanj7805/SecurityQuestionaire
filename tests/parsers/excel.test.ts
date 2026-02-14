import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel } from "@/lib/parsers/excel";

function createExcelBuffer(
  sheets: {
    name: string;
    data: Record<string, string>[];
  }[]
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("parseExcel", () => {
  it("parses a standard Q&A format sheet", () => {
    const buffer = createExcelBuffer([
      {
        name: "Sheet1",
        data: [
          { Question: "Do you have SOC 2?", Answer: "Yes, we are SOC 2 Type II certified." },
          { Question: "What is your DR plan?", Answer: "We have a documented DR plan." },
          { Question: "Do you encrypt data?", Answer: "Yes, AES-256 encryption." },
        ],
      },
    ]);

    const result = parseExcel(buffer);

    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].name).toBe("Sheet1");
    expect(result.sheets[0].headers).toContain("Question");
    expect(result.sheets[0].headers).toContain("Answer");
    expect(result.qaRows).toHaveLength(3);
    expect(result.qaRows[0].question).toBe("Do you have SOC 2?");
    expect(result.qaRows[0].answer).toBe("Yes, we are SOC 2 Type II certified.");
  });

  it("detects alternative Q&A header patterns", () => {
    const buffer = createExcelBuffer([
      {
        name: "Requirements",
        data: [
          { Requirement: "MFA enabled?", Response: "Yes" },
          { Requirement: "Firewall?", Response: "Yes, WAF deployed" },
        ],
      },
    ]);

    const result = parseExcel(buffer);
    expect(result.qaRows).toHaveLength(2);
    expect(result.qaRows[0].question).toBe("MFA enabled?");
    expect(result.qaRows[0].answer).toBe("Yes");
  });

  it("handles multi-sheet workbooks", () => {
    const buffer = createExcelBuffer([
      {
        name: "General",
        data: [
          { Question: "Company name?", Answer: "Acme Corp" },
        ],
      },
      {
        name: "Technical",
        data: [
          { Question: "Cloud provider?", Answer: "AWS" },
          { Question: "Database?", Answer: "PostgreSQL" },
        ],
      },
    ]);

    const result = parseExcel(buffer);

    expect(result.sheets).toHaveLength(2);
    expect(result.qaRows).toHaveLength(3);
    expect(result.rawText).toContain("General");
    expect(result.rawText).toContain("Technical");
  });

  it("returns empty qaRows when no Q&A columns detected", () => {
    const buffer = createExcelBuffer([
      {
        name: "Data",
        data: [
          { Name: "Alice", Role: "Admin" },
          { Name: "Bob", Role: "User" },
        ],
      },
    ]);

    const result = parseExcel(buffer);

    expect(result.sheets).toHaveLength(1);
    expect(result.qaRows).toHaveLength(0);
  });

  it("skips empty sheets", () => {
    const workbook = XLSX.utils.book_new();
    const emptySheet = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, emptySheet, "Empty");

    const dataSheet = XLSX.utils.json_to_sheet([
      { Question: "Test?", Answer: "Yes" },
    ]);
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Data");

    const buffer = Buffer.from(
      XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
    );

    const result = parseExcel(buffer);
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].name).toBe("Data");
  });

  it("skips rows with empty questions", () => {
    const buffer = createExcelBuffer([
      {
        name: "Sheet1",
        data: [
          { Question: "Valid question?", Answer: "Yes" },
          { Question: "", Answer: "No question here" },
          { Question: "Another valid?", Answer: "Sure" },
        ],
      },
    ]);

    const result = parseExcel(buffer);
    expect(result.qaRows).toHaveLength(2);
  });
});
