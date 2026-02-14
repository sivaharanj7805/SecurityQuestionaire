"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ClipboardList, MessageSquare, BookOpen } from "lucide-react";

interface DashboardStats {
  documents: number;
  questionnaires: number;
  questionsAnswered: number;
  libraryEntries: number;
}

const statsMeta = [
  {
    key: "documents" as const,
    title: "Documents",
    description: "In knowledge base",
    icon: FileText,
  },
  {
    key: "questionnaires" as const,
    title: "Questionnaires",
    description: "Total questionnaires",
    icon: ClipboardList,
  },
  {
    key: "questionsAnswered" as const,
    title: "Questions Answered",
    description: "AI-assisted answers",
    icon: MessageSquare,
  },
  {
    key: "libraryEntries" as const,
    title: "Library Entries",
    description: "Approved answers",
    icon: BookOpen,
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    documents: 0,
    questionnaires: 0,
    questionsAnswered: 0,
    libraryEntries: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        console.error("Failed to fetch dashboard stats");
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to SecureQuest. Get started by uploading documents to your
          knowledge base.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsMeta.map((meta) => (
          <Card key={meta.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {meta.title}
              </CardTitle>
              <meta.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats[meta.key]}</div>
              <p className="text-xs text-muted-foreground">
                {meta.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
