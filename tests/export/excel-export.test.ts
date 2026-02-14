import { describe, it, expect } from "vitest";
import { generateExcelExport } from "@/lib/export/excel-export";
import * as XLSX from "xlsx";

describe("Excel export", () => {
  const sampleQuestions = [
    {
      section: "Access Control",
      questionText: "Do you implement MFA?",
      answer: "Yes, we require MFA for all users.",
      confidence: "high",
      status: "approved",
    },
    {
      section: "Encryption",
      questionText: "Do you encrypt data at rest?",
      answer: "Yes, AES-256 encryption is used.",
      confidence: "high",
      status: "approved",
    },
    {
      section: "Compliance",
      questionText: "Do you have ISO 27001?",
      answer: "N/A",
      confidence: "none",
      status: "skipped",
    },
  ];

  it("generates a valid xlsx buffer", () => {
    const buffer = generateExcelExport("Test Questionnaire", sampleQuestions);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // Verify it's a valid ZIP/XLSX (starts with PK header)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("includes all questions in export", () => {
    const buffer = generateExcelExport("Test Questionnaire", sampleQuestions);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(data.length).toBe(3);
  });

  it("preserves question text correctly", () => {
    const buffer = generateExcelExport("Test Questionnaire", sampleQuestions);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(data[0]["Question"]).toBe("Do you implement MFA?");
    expect(data[1]["Answer"]).toBe("Yes, AES-256 encryption is used.");
  });

  it("preserves section names", () => {
    const buffer = generateExcelExport("Test Questionnaire", sampleQuestions);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(data[0]["Section"]).toBe("Access Control");
  });

  it("capitalizes confidence and status", () => {
    const buffer = generateExcelExport("Test Questionnaire", sampleQuestions);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(data[0]["Confidence"]).toBe("High");
    expect(data[0]["Status"]).toBe("Approved");
  });

  it("handles special characters in answers", () => {
    const specialQ = [
      {
        section: "Test",
        questionText: "Question with <html> & \"quotes\"?",
        answer: "Answer with <tags> & 'special' chars",
        confidence: "high",
        status: "approved",
      },
    ];
    const buffer = generateExcelExport("Special Chars", specialQ);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(data[0]["Answer"]).toContain("&");
    expect(data[0]["Answer"]).toContain("'special'");
  });

  it("handles empty questions array", () => {
    const buffer = generateExcelExport("Empty", []);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles very long answers without truncation", () => {
    const longAnswer = "A".repeat(5000);
    const longQ = [
      {
        section: "Test",
        questionText: "Long question?",
        answer: longAnswer,
        confidence: "high",
        status: "approved",
      },
    ];
    const buffer = generateExcelExport("Long Answers", longQ);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(data[0]["Answer"].length).toBe(5000);
  });
});
