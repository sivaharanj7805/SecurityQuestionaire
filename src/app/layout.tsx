import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "SecureQuest - AI-Powered Security Questionnaire Responder",
    template: "%s | SecureQuest",
  },
  description:
    "Answer security questionnaires 10x faster with AI. Upload your knowledge base, import questionnaires, and let AI draft accurate responses.",
  keywords: [
    "security questionnaire",
    "AI responder",
    "SOC 2",
    "compliance",
    "vendor assessment",
    "security assessment",
  ],
  openGraph: {
    title: "SecureQuest - AI-Powered Security Questionnaire Responder",
    description:
      "Answer security questionnaires 10x faster with AI. Upload your knowledge base, import questionnaires, and let AI draft accurate responses.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider dynamic>
      <html lang="en">
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
