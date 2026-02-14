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

export async function parseDocument(
  buffer: Buffer,
  fileType: string
): Promise<ParsedDocument> {
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
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
