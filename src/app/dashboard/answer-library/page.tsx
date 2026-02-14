import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnswerLibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Answer Library</h1>
        <p className="text-muted-foreground">
          Browse and manage your approved answers for reuse across
          questionnaires.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved Answers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No answers yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Approved answers from completed questionnaires will appear here
              for easy reuse.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
