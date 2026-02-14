import { describe, it, expect } from "vitest";
import { parseDocument, DocumentParseError } from "@/lib/parsers";

describe("Parser error handling", () => {
  it("throws DocumentParseError for empty buffer", async () => {
    await expect(parseDocument(Buffer.alloc(0), "pdf")).rejects.toThrow(
      DocumentParseError
    );
    await expect(parseDocument(Buffer.alloc(0), "pdf")).rejects.toThrow(
      "empty"
    );
  });

  it("throws DocumentParseError for unsupported file type", async () => {
    const buffer = Buffer.from("some content");
    await expect(parseDocument(buffer, "exe")).rejects.toThrow(
      DocumentParseError
    );
    await expect(parseDocument(buffer, "exe")).rejects.toThrow(
      "Unsupported file type"
    );
  });

  it("throws DocumentParseError for corrupt PDF data", async () => {
    const corruptPdf = Buffer.from("not a real pdf file contents");
    await expect(parseDocument(corruptPdf, "pdf")).rejects.toThrow(
      DocumentParseError
    );
  });

  it("handles corrupt XLSX data gracefully (returns empty or throws)", async () => {
    // The xlsx library is lenient — it may return empty data instead of throwing.
    // Either behavior is acceptable as long as it doesn't crash.
    const corruptXlsx = Buffer.from("not a real xlsx file");
    try {
      const result = await parseDocument(corruptXlsx, "xlsx");
      // If it doesn't throw, it should return empty data
      expect(result.rawText).toBe("");
      expect(result.sections).toHaveLength(0);
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentParseError);
    }
  });

  it("throws DocumentParseError for corrupt DOCX data", async () => {
    const corruptDocx = Buffer.from("not a real docx file");
    await expect(parseDocument(corruptDocx, "docx")).rejects.toThrow(
      DocumentParseError
    );
  });

  it("DocumentParseError includes fileType property", async () => {
    try {
      await parseDocument(Buffer.alloc(0), "pdf");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentParseError);
      expect((error as DocumentParseError).fileType).toBe("pdf");
    }
  });

  it("DocumentParseError includes original cause for corrupt files", async () => {
    try {
      await parseDocument(Buffer.from("corrupt"), "xlsx");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentParseError);
      // Cause should be set for wrapped errors
      expect((error as DocumentParseError).cause).toBeDefined();
    }
  });
});
