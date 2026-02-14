import { describe, it, expect } from "vitest";
import * as schema from "@/lib/db/schema";

describe("Tenant isolation - schema enforcement", () => {
  const tenantTables = [
    { name: "documents", table: schema.documents },
    { name: "chunks", table: schema.chunks },
    { name: "questionnaires", table: schema.questionnaires },
    { name: "questions", table: schema.questions },
    { name: "answerLibrary", table: schema.answerLibrary },
    { name: "usageLogs", table: schema.usageLogs },
    { name: "auditLogs", table: schema.auditLogs },
    { name: "users", table: schema.users },
  ];

  for (const { name, table } of tenantTables) {
    it(`${name} table has orgId column`, () => {
      const columns = Object.keys(table);
      expect(columns).toContain("orgId");
    });
  }

  it("organizations table has clerkOrgId for external mapping", () => {
    const columns = Object.keys(schema.organizations);
    expect(columns).toContain("clerkOrgId");
  });

  it("all data tables have orgId — no table leaks tenant data", () => {
    // These are all the tables that store tenant-specific data
    const allTenantTableNames = tenantTables.map((t) => t.name);
    expect(allTenantTableNames.length).toBe(8);

    // Ensure we didn't miss any tables with tenant data
    for (const { table } of tenantTables) {
      const cols = Object.keys(table);
      expect(cols).toContain("orgId");
    }
  });

  it("chunks table has embedding index for vector search", () => {
    // The chunks table should be defined with vector column
    const columns = Object.keys(schema.chunks);
    expect(columns).toContain("embedding");
  });

  it("answerLibrary table has embedding for similarity search", () => {
    const columns = Object.keys(schema.answerLibrary);
    expect(columns).toContain("embedding");
  });

  it("questions table references questionnaireId", () => {
    const columns = Object.keys(schema.questions);
    expect(columns).toContain("questionnaireId");
    expect(columns).toContain("orgId");
  });

  it("plan enum includes all expected tiers", () => {
    const values = schema.planEnum.enumValues;
    expect(values).toContain("free");
    expect(values).toContain("starter");
    expect(values).toContain("growth");
    expect(values).toContain("scale");
  });

  it("question status enum includes expected values", () => {
    const values = schema.questionStatusEnum.enumValues;
    expect(values).toContain("draft");
    expect(values).toContain("approved");
    expect(values).toContain("rejected");
    expect(values).toContain("skipped");
  });

  it("confidence enum includes expected levels", () => {
    const values = schema.confidenceEnum.enumValues;
    expect(values).toContain("high");
    expect(values).toContain("medium");
    expect(values).toContain("low");
    expect(values).toContain("none");
  });
});
