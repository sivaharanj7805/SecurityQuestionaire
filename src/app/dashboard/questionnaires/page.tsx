"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

interface Questionnaire {
  id: string;
  name: string;
  status: "processing" | "draft" | "in_review" | "completed" | "exported";
  questionCount: number | null;
  completedCount: number;
  createdAt: string;
}

function StatusBadge({ status }: { status: Questionnaire["status"] }) {
  switch (status) {
    case "processing":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          Processing
        </Badge>
      );
    case "draft":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          Draft
        </Badge>
      );
    case "in_review":
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
          In Review
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Completed
        </Badge>
      );
    case "exported":
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-800">
          Exported
        </Badge>
      );
  }
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function QuestionnairesPage() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchQuestionnaires = useCallback(async () => {
    try {
      const res = await fetch("/api/questionnaires");
      if (res.ok) {
        setQuestionnaires(await res.json());
      }
    } catch {
      console.error("Failed to fetch questionnaires");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestionnaires();
  }, [fetchQuestionnaires]);

  // Poll when any questionnaires are processing
  useEffect(() => {
    const hasProcessing = questionnaires.some(
      (q) => q.status === "processing"
    );
    if (!hasProcessing) return;

    const interval = setInterval(fetchQuestionnaires, 3000);
    return () => clearInterval(interval);
  }, [questionnaires, fetchQuestionnaires]);

  const toDelete = questionnaires.find((q) => q.id === deleteId);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/questionnaires/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({
          title: "Questionnaire deleted",
          description: "The questionnaire has been permanently removed.",
        });
        fetchQuestionnaires();
      } else {
        throw new Error("Delete failed");
      }
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not delete the questionnaire.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Questionnaires</h1>
          <p className="text-muted-foreground">
            Import and manage security questionnaires.
          </p>
        </div>
        <Link href="/dashboard/questionnaires/import">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Import New
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Questionnaires</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : questionnaires.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                No questionnaires yet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Import a security questionnaire to get started. We support Excel
                spreadsheets.
              </p>
              <Link href="/dashboard/questionnaires/import" className="mt-4">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Import Your First Questionnaire
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Questions
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {questionnaires.map((q) => {
                    const total = q.questionCount ?? 0;
                    const pct =
                      total > 0
                        ? Math.round((q.completedCount / total) * 100)
                        : 0;

                    return (
                      <tr key={q.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/questionnaires/${q.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {q.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {total}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 w-20" />
                            <span className="text-xs text-muted-foreground">
                              {q.completedCount}/{total}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={q.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(q.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/questionnaires/${q.id}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View / Review
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(q.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Questionnaire</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{toDelete?.name}&rdquo;?
              This will permanently remove all questions and AI-generated
              answers. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
