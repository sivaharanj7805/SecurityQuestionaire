import { db } from "@/lib/db";
import { documents, questionnaires, questions, chunks } from "@/lib/db/schema";
import { SAMPLE_SECURITY_POLICY, SAMPLE_QUESTIONS } from "./sample-data";

export async function seedDemoData(
  orgId: string,
  userId: string
): Promise<{ documentId: string; questionnaireId: string }> {
  // 1. Create a demo document
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      filename: "sample-security-policy.pdf",
      fileKey: `demo/${orgId}/sample-security-policy.pdf`,
      fileType: "pdf",
      fileSize: SAMPLE_SECURITY_POLICY.length,
      status: "ready",
      pageCount: 3,
      uploadedBy: userId,
    })
    .returning();

  // 2. Create chunks from the policy text (split by sections)
  const sectionRegex = /## \d+\.\s+(.+)\n([\s\S]*?)(?=## \d+\.|$)/g;
  let match: RegExpExecArray | null;
  let chunkIndex = 0;

  while ((match = sectionRegex.exec(SAMPLE_SECURITY_POLICY)) !== null) {
    const sectionText = match[2].trim();
    if (sectionText.length > 0) {
      await db.insert(chunks).values({
        orgId,
        documentId: doc.id,
        chunkText: sectionText,
        metadata: {
          section: match[1].trim(),
          chunkIndex,
          sourceDocId: doc.id,
        },
        chunkIndex,
        // No embedding — demo data won't be used for real vector search
      });
      chunkIndex++;
    }
  }

  // 3. Create a demo questionnaire
  const [questionnaire] = await db
    .insert(questionnaires)
    .values({
      orgId,
      name: "Sample Security Questionnaire",
      status: "in_review",
      questionCount: SAMPLE_QUESTIONS.length,
      completedCount: 0,
      createdBy: userId,
    })
    .returning();

  // 4. Create demo questions with pre-filled AI answers
  const sampleAnswers: Record<string, string> = {
    "Do you require multi-factor authentication for access to production systems?":
      "Yes. All access to production systems requires multi-factor authentication (MFA). Access is granted on a least-privilege basis and reviewed quarterly.",
    "Describe your access control policies and how access is granted and revoked.":
      "Access is granted on a least-privilege basis and reviewed quarterly. All access changes are logged in our audit system. Access is revoked promptly when employees change roles or leave the organization.",
    "Do you encrypt data at rest and in transit?":
      "Yes. Data is encrypted at rest using AES-256 and in transit using TLS 1.3.",
    "What encryption standards and key management practices do you use?":
      "We use AES-256 encryption at rest and TLS 1.3 in transit. Encryption keys are managed through AWS KMS with automatic key rotation every 365 days. Database backups are encrypted using the same standards.",
    "Do you have a documented incident response plan?":
      "Yes. We maintain a documented incident response plan that is tested annually through tabletop exercises.",
    "Describe your incident response process, including response time targets.":
      "Our incident response team is available 24/7 with a target response time of 15 minutes for critical incidents. All incidents are documented and reviewed in post-mortem meetings. The plan is tested annually.",
    "What are your Recovery Time Objective (RTO) and Recovery Point Objective (RPO)?":
      "Our Recovery Time Objective (RTO) is 4 hours and Recovery Point Objective (RPO) is 1 hour. We conduct DR tests semi-annually with automated daily backups stored in geographically separate regions.",
    "Do you hold SOC 2 Type II certification?":
      "Yes. We maintain SOC 2 Type II certification audited annually by an independent third-party auditor.",
    "Describe your vulnerability management and patching process.":
      "We perform automated vulnerability scans weekly and manual penetration testing annually. Critical vulnerabilities are patched within 24 hours, high within 7 days, medium within 30 days, and low within 90 days.",
    "How do you assess and monitor third-party vendor security?":
      "All third-party vendors undergo security assessment before onboarding. Vendors with access to sensitive data must provide SOC 2 Type II reports or equivalent certifications. Vendor access is reviewed annually.",
  };

  for (const q of SAMPLE_QUESTIONS) {
    await db.insert(questions).values({
      questionnaireId: questionnaire.id,
      orgId,
      section: q.section,
      questionText: q.questionText,
      answerFormat: q.answerFormat,
      aiAnswer: sampleAnswers[q.questionText] ?? null,
      confidence: sampleAnswers[q.questionText] ? "high" : "none",
      status: "draft",
    });
  }

  return { documentId: doc.id, questionnaireId: questionnaire.id };
}
