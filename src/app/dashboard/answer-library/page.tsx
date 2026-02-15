"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Edit2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

interface LibraryEntry {
  id: string;
  questionPattern: string;
  approvedAnswer: string;
  timesReused: number;
  lastUsedAt: string | null;
  createdAt: string;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function AnswerLibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LibraryEntry | null>(null);
  const [formPattern, setFormPattern] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/answer-library");
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch {
      console.error("Failed to fetch answer library entries");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.questionPattern.toLowerCase().includes(q) ||
        e.approvedAnswer.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  function openAddDialog() {
    setEditingEntry(null);
    setFormPattern("");
    setFormAnswer("");
    setDialogOpen(true);
  }

  function openEditDialog(entry: LibraryEntry) {
    setEditingEntry(entry);
    setFormPattern(entry.questionPattern);
    setFormAnswer(entry.approvedAnswer);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formPattern.trim() || !formAnswer.trim()) {
      toast({
        title: "Missing fields",
        description: "Both question pattern and answer are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingEntry) {
        const res = await fetch("/api/answer-library", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryId: editingEntry.id,
            questionPattern: formPattern,
            approvedAnswer: formAnswer,
          }),
        });
        if (res.ok) {
          toast({ title: "Entry updated" });
          setDialogOpen(false);
          fetchEntries();
        } else {
          throw new Error("Update failed");
        }
      } else {
        const res = await fetch("/api/answer-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionPattern: formPattern,
            approvedAnswer: formAnswer,
          }),
        });
        if (res.ok) {
          toast({ title: "Entry added to library" });
          setDialogOpen(false);
          fetchEntries();
        } else {
          throw new Error("Create failed");
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save entry.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/answer-library?id=${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Entry deleted" });
        fetchEntries();
      } else {
        throw new Error("Delete failed");
      }
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not delete the entry.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }

  const toDelete = entries.find((e) => e.id === deleteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Answer Library</h1>
          <p className="text-muted-foreground">
            Browse and manage your approved answers for reuse across
            questionnaires.
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Approved Answers</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patterns or answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                {entries.length === 0
                  ? "No answers yet"
                  : "No matching entries"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {entries.length === 0
                  ? "Approved answers from completed questionnaires will appear here for easy reuse."
                  : "Try adjusting your search query."}
              </p>
              {entries.length === 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={openAddDialog}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Entry
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Question Pattern
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Approved Answer
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium w-24">
                      Reused
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium w-28">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="text-sm line-clamp-2">
                          {entry.questionPattern}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.approvedAnswer}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {entry.timesReused}x
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(entry)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteId(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Library Entry" : "Add to Answer Library"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update the question pattern or approved answer."
                : "Add a reusable answer that will be automatically suggested for similar questions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pattern">Question Pattern</Label>
              <textarea
                id="pattern"
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value)}
                className="w-full min-h-[80px] rounded-md border bg-background p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., Do you have a SOC 2 certification?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Approved Answer</Label>
              <textarea
                id="answer"
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                className="w-full min-h-[120px] rounded-md border bg-background p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="The approved answer to use for this type of question..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingEntry
                  ? "Update Entry"
                  : "Add to Library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Library Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this entry? The question pattern
              &ldquo;
              {toDelete?.questionPattern.substring(0, 80)}
              {(toDelete?.questionPattern.length ?? 0) > 80 ? "..." : ""}
              &rdquo; will be permanently removed.
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
