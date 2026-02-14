import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function QuestionnairesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Questionnaires</h1>
          <p className="text-muted-foreground">
            Import and manage security questionnaires.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Questionnaire
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Questionnaires</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">
              No questionnaires yet
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Import a security questionnaire to get started. We support Excel,
              CSV, and PDF formats.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
