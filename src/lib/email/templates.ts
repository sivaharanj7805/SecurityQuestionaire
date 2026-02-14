import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? "SecureQuest <noreply@securequest.app>";

export async function sendWelcomeEmail(
  to: string,
  orgName: string
): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Welcome to SecureQuest, ${orgName}!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a;">Welcome to SecureQuest!</h1>
        <p>Hi there,</p>
        <p>Your organization <strong>${orgName}</strong> is all set up. Here's how to get started:</p>
        <ol>
          <li><strong>Upload documents</strong> — Add security policies, SOC 2 reports, and compliance docs to your knowledge base.</li>
          <li><strong>Import a questionnaire</strong> — Upload an Excel questionnaire and let AI draft answers.</li>
          <li><strong>Review & export</strong> — Review AI answers, approve them, and export as XLSX or DOCX.</li>
        </ol>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
          Go to Dashboard
        </a>
        <p style="color: #666; margin-top: 24px; font-size: 14px;">
          Questions? Reply to this email or visit our docs.
        </p>
      </div>
    `,
  });
}

export async function sendQuestionnaireReadyEmail(
  to: string,
  questionnaireName: string,
  questionCount: number
): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Questionnaire ready for review: ${questionnaireName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a;">Questionnaire Ready for Review</h1>
        <p>AI has finished processing <strong>${questionnaireName}</strong>.</p>
        <p style="font-size: 18px; color: #2563eb;">
          <strong>${questionCount}</strong> questions answered
        </p>
        <p>Review the AI-generated answers, edit as needed, and approve them for export.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/questionnaires" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
          Review Answers
        </a>
      </div>
    `,
  });
}

export async function sendExportCompleteEmail(
  to: string,
  questionnaireName: string,
  format: string
): Promise<void> {
  const resend = getResend();

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Export complete: ${questionnaireName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a;">Export Complete</h1>
        <p><strong>${questionnaireName}</strong> has been exported as <strong>${format.toUpperCase()}</strong>.</p>
        <p>You can download it again from the questionnaire review page.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/questionnaires" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
          View Questionnaires
        </a>
      </div>
    `,
  });
}
