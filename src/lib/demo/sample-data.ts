export const SAMPLE_SECURITY_POLICY = `# Information Security Policy

## 1. Access Control
All access to production systems requires multi-factor authentication (MFA). Access is granted on a least-privilege basis and reviewed quarterly. All access changes are logged in our audit system.

## 2. Data Encryption
Data is encrypted at rest using AES-256 and in transit using TLS 1.3. Encryption keys are managed through AWS KMS with automatic key rotation every 365 days. Database backups are encrypted using the same standards.

## 3. Incident Response
We maintain a documented incident response plan that is tested annually through tabletop exercises. Our incident response team is available 24/7 with a target response time of 15 minutes for critical incidents. All incidents are documented and reviewed in post-mortem meetings.

## 4. Business Continuity
Our disaster recovery plan includes automated daily backups stored in geographically separate regions. Recovery Time Objective (RTO) is 4 hours and Recovery Point Objective (RPO) is 1 hour. We conduct DR tests semi-annually.

## 5. Vendor Management
All third-party vendors undergo security assessment before onboarding. Vendors with access to sensitive data must provide SOC 2 Type II reports or equivalent certifications. Vendor access is reviewed annually and terminated promptly when no longer needed.

## 6. Employee Security
All employees complete security awareness training upon hire and annually thereafter. Background checks are performed for all employees with access to sensitive data. Employees sign confidentiality agreements and acceptable use policies.

## 7. Network Security
Our network is protected by next-generation firewalls and web application firewalls (WAF). We maintain network segmentation between production, staging, and development environments. Intrusion detection and prevention systems (IDS/IPS) monitor network traffic 24/7.

## 8. Compliance
We maintain SOC 2 Type II certification audited annually by an independent third-party auditor. We are compliant with GDPR for European data subjects and CCPA for California residents. Compliance status is reviewed quarterly by our security team.

## 9. Vulnerability Management
We perform automated vulnerability scans weekly and manual penetration testing annually through qualified third-party firms. Critical vulnerabilities are patched within 24 hours, high within 7 days, medium within 30 days, and low within 90 days.

## 10. Physical Security
Our offices use keycard access control with visitor logging. Production infrastructure is hosted in SOC 2 certified data centers with 24/7 physical security, biometric access, and video surveillance.
`;

export const SAMPLE_QUESTIONS: {
  section: string;
  questionText: string;
  answerFormat: "freetext" | "yes_no";
}[] = [
  {
    section: "Access Control",
    questionText: "Do you require multi-factor authentication for access to production systems?",
    answerFormat: "yes_no",
  },
  {
    section: "Access Control",
    questionText: "Describe your access control policies and how access is granted and revoked.",
    answerFormat: "freetext",
  },
  {
    section: "Encryption",
    questionText: "Do you encrypt data at rest and in transit?",
    answerFormat: "yes_no",
  },
  {
    section: "Encryption",
    questionText: "What encryption standards and key management practices do you use?",
    answerFormat: "freetext",
  },
  {
    section: "Incident Response",
    questionText: "Do you have a documented incident response plan?",
    answerFormat: "yes_no",
  },
  {
    section: "Incident Response",
    questionText: "Describe your incident response process, including response time targets.",
    answerFormat: "freetext",
  },
  {
    section: "Business Continuity",
    questionText: "What are your Recovery Time Objective (RTO) and Recovery Point Objective (RPO)?",
    answerFormat: "freetext",
  },
  {
    section: "Compliance",
    questionText: "Do you hold SOC 2 Type II certification?",
    answerFormat: "yes_no",
  },
  {
    section: "Vulnerability Management",
    questionText: "Describe your vulnerability management and patching process.",
    answerFormat: "freetext",
  },
  {
    section: "Vendor Management",
    questionText: "How do you assess and monitor third-party vendor security?",
    answerFormat: "freetext",
  },
];
