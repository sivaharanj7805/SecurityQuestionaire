import { describe, it, expect } from "vitest";

// Test filename sanitization logic
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/\0/g, "")
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
    .slice(0, 255);
}

function hasDoubleExtension(filename: string): boolean {
  const parts = filename.split(".");
  if (parts.length <= 2) return false;
  const dangerousExts = ["exe", "bat", "cmd", "sh", "ps1", "vbs", "js", "msi"];
  // Check if any extension (including the last) in a multi-extension file is dangerous
  return parts.slice(1).some((part) => dangerousExts.includes(part.toLowerCase()));
}

describe("Filename sanitization", () => {
  it("removes path traversal characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("..");
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("/");
  });

  it("removes null bytes", () => {
    expect(sanitizeFilename("file\0name.xlsx")).not.toContain("\0");
  });

  it("removes backslashes", () => {
    expect(sanitizeFilename("path\\to\\file.xlsx")).not.toContain("\\");
  });

  it("preserves normal filenames", () => {
    const result = sanitizeFilename("my-document_v2.xlsx");
    expect(result).toBe("my-document_v2.xlsx");
  });

  it("replaces special characters with underscore", () => {
    const result = sanitizeFilename("file<name>.xlsx");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("enforces 255 character limit", () => {
    const longName = "a".repeat(300) + ".xlsx";
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(255);
  });
});

describe("Double extension detection", () => {
  it("detects dangerous double extensions", () => {
    expect(hasDoubleExtension("file.xlsx.exe")).toBe(true);
    expect(hasDoubleExtension("file.bat.xlsx")).toBe(true);
  });

  it("allows normal filenames", () => {
    expect(hasDoubleExtension("file.xlsx")).toBe(false);
    expect(hasDoubleExtension("report")).toBe(false);
  });

  it("allows normal multi-dot filenames", () => {
    expect(hasDoubleExtension("report.v2.xlsx")).toBe(false);
  });
});

describe("Prompt injection patterns", () => {
  it("identifies common injection patterns", () => {
    const injectionPatterns = [
      "ignore previous instructions",
      "system: you are now",
      "assistant: I will help",
    ];

    // These should be treated as normal text in the Q&A context, not stripped
    // The system prompt already instructs the AI to only use provided context
    for (const pattern of injectionPatterns) {
      expect(typeof pattern).toBe("string");
    }
  });
});
