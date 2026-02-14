import mammoth from "mammoth";

interface WordSection {
  heading: string;
  content: string;
}

interface WordParseResult {
  text: string;
  sections: WordSection[];
  tables: string[][][];
}

export async function parseWord(buffer: Buffer): Promise<WordParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  const fullText = result.value;

  // Also extract HTML to parse sections and tables
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const html = htmlResult.value;

  const sections = extractSections(fullText);
  const tables = extractTablesFromHtml(html);

  return {
    text: fullText,
    sections,
    tables,
  };
}

function extractSections(text: string): WordSection[] {
  const lines = text.split("\n");
  const sections: WordSection[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentContent.length > 0) {
        currentContent.push("");
      }
      continue;
    }

    // Heuristic: headings are short lines (< 100 chars) that don't end with
    // typical sentence punctuation, and are followed by longer content
    const isLikelyHeading =
      trimmed.length < 100 &&
      !trimmed.endsWith(".") &&
      !trimmed.endsWith(",") &&
      !trimmed.endsWith(";") &&
      trimmed === trimmed.replace(/^\d+[\.\)]\s*/, ""); // not a numbered list item with content

    if (isLikelyHeading && trimmed.length > 2 && trimmed.length < 80) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = trimmed;
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  }

  // Push final section
  if (currentHeading || currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  return sections;
}

function extractTablesFromHtml(html: string): string[][][] {
  const tables: string[][][] = [];

  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rows: string[][] = [];

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];

      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const cellText = cellMatch[1]
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();
        cells.push(cellText);
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) {
      tables.push(rows);
    }
  }

  return tables;
}
