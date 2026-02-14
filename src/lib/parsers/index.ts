import { parseExcel } from "./excel";
import { parseWord } from "./word";
import { parsePdf } from "./pdf";

interface ParsedSection {
  heading: string;
  content: string;
}

export interface ParsedDocument {
  rawText: string;
  sections: ParsedSection[];
  metadata: {
    fileType: string;
    pageCount?: number;
    sheetCount?: number;
    qaRowCount?: number;
  };
}

export class DocumentParseError extends Error {
  constructor(
    message: string,
    public readonly fileType: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DocumentParseError";
  }
}

export async function parseDocument(
  buffer: Buffer,
  fileType: string
): Promise<ParsedDocument> {
  if (!buffer || buffer.length === 0) {
    throw new DocumentParseError("File is empty or contains no data.", fileType);
  }

  try {
    switch (fileType) {
      case "xlsx": {
        const result = parseExcel(buffer);
        return {
          rawText: result.rawText,
          sections: result.sheets.map((sheet) => ({
            heading: sheet.name,
            content: sheet.rawText,
          })),
          metadata: {
            fileType: "xlsx",
            sheetCount: result.sheets.length,
            qaRowCount: result.qaRows.length,
          },
        };
      }

      case "docx": {
        const result = await parseWord(buffer);
        return {
          rawText: result.text,
          sections:
            result.sections.length > 0
              ? result.sections
              : [{ heading: "", content: result.text }],
          metadata: {
            fileType: "docx",
          },
        };
      }

      case "pdf": {
        const result = await parsePdf(buffer);
        return {
          rawText: result.text,
          sections:
            result.pages.length > 0
              ? result.pages.map((page) => ({
                  heading: `Page ${page.pageNumber}`,
                  content: page.text,
                }))
              : [{ heading: "", content: result.text }],
          metadata: {
            fileType: "pdf",
            pageCount: result.pageCount,
          },
        };
      }

      default:
        throw new DocumentParseError(`Unsupported file type: ${fileType}`, fileType);
    }
  } catch (error) {
    // Re-throw our own errors
    if (error instanceof DocumentParseError) {
      throw error;
    }

    // Detect password-protected files
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("password") ||
      message.includes("encrypted") ||
      message.includes("Password")
    ) {
      throw new DocumentParseError(
        "This file appears to be password-protected. Please upload an unprotected version.",
        fileType,
        error
      );
    }

    // Detect corrupt files
    if (
      message.includes("Invalid") ||
      message.includes("corrupt") ||
      message.includes("Malformed") ||
      message.includes("unexpected end")
    ) {
      throw new DocumentParseError(
        "This file appears to be corrupt or malformed. Please verify the file and try again.",
        fileType,
        error
      );
    }

    // Generic parse failure
    throw new DocumentParseError(
      `Failed to parse ${fileType.toUpperCase()} file: ${message}`,
      fileType,
      error
    );
  }
}
