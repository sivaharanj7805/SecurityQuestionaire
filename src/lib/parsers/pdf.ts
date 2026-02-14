import { PDFParse } from "pdf-parse";

interface PdfPage {
  pageNumber: number;
  text: string;
}

interface PdfParseResult {
  text: string;
  pages: PdfPage[];
  pageCount: number;
}

export async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const textResult = await parser.getText();

    const pages: PdfPage[] = textResult.pages
      .map((page) => ({
        pageNumber: page.num,
        text: page.text.trim(),
      }))
      .filter((page) => page.text.length > 0);

    return {
      text: textResult.text,
      pages,
      pageCount: textResult.total,
    };
  } finally {
    await parser.destroy();
  }
}
