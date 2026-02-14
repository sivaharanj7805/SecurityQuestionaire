import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
} from "docx";

interface ExportQuestion {
  section: string | null;
  questionText: string;
  answer: string;
  confidence: string;
  status: string;
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: 20,
            color: "FFFFFF",
          }),
        ],
      }),
    ],
    shading: {
      type: ShadingType.SOLID,
      color: "2563EB",
      fill: "2563EB",
    },
    width: { size: 50, type: WidthType.PERCENTAGE },
  });
}

function bodyCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: 20,
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
    },
  });
}

export async function generateWordExport(
  questionnaireName: string,
  questions: ExportQuestion[]
): Promise<Buffer> {
  const sections: string[] = [];
  const sectionMap = new Map<string, ExportQuestion[]>();

  for (const q of questions) {
    const section = q.section ?? "General";
    if (!sectionMap.has(section)) {
      sections.push(section);
      sectionMap.set(section, []);
    }
    sectionMap.get(section)!.push(q);
  }

  const children: (Paragraph | Table)[] = [];

  // Title page
  children.push(
    new Paragraph({
      text: questionnaireName,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          size: 22,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Questions: ${questions.length}`,
          size: 22,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // Each section
  for (const sectionName of sections) {
    const sectionQuestions = sectionMap.get(sectionName)!;

    children.push(
      new Paragraph({
        text: sectionName,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // Q&A table for this section
    const tableRows: TableRow[] = [
      new TableRow({
        children: [
          headerCell("Question"),
          headerCell("Answer"),
        ],
        tableHeader: true,
      }),
    ];

    for (const q of sectionQuestions) {
      tableRows.push(
        new TableRow({
          children: [
            bodyCell(q.questionText),
            bodyCell(q.answer),
          ],
        })
      );
    }

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
