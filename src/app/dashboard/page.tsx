import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ClipboardList, MessageSquare, BookOpen } from "lucide-react";

const stats = [
  {
    title: "Documents",
    value: "0",
    description: "In knowledge base",
    icon: FileText,
  },
  {
    title: "Questionnaires",
    value: "0",
    description: "Total questionnaires",
    icon: ClipboardList,
  },
  {
    title: "Questions Answered",
    value: "0",
    description: "AI-assisted answers",
    icon: MessageSquare,
  },
  {
    title: "Library Entries",
    value: "0",
    description: "Approved answers",
    icon: BookOpen,
  },
];

export default function DashboardPage() {
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
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
