"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LibraryBig,
  RefreshCw,
  Search,
  SkipForward,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  questionnaireId: string;
  orgId: string;
  section: string | null;
  questionText: string;
  answerFormat: "freetext" | "yes_no" | "multiple_choice";
  aiAnswer: string | null;
  humanAnswer: string | null;
  confidence: "high" | "medium" | "low" | "none";
  status: "draft" | "approved" | "rejected" | "skipped";
  sourceChunkIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface Questionnaire {
  id: string;
  name: string;
  status: string;
  questionCount: number | null;
  completedCount: number;
}

type ConfidenceFilter = "all" | "high" | "medium" | "low" | "none";
type StatusFilter = "all" | "draft" | "approved" | "rejected" | "skipped";

function ConfidenceBadge({ confidence }: { confidence: Question["confidence"] }) {
  switch (confidence) {
    case "high":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
          High
        </Badge>
      );
    case "medium":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
          Medium
        </Badge>
      );
    case "low":
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
          Low
        </Badge>
      );
    case "none":
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
          None
        </Badge>
      );
  }
}

function StatusIcon({ status }: { status: Question["status"] }) {
  switch (status) {
    case "approved":
      return <Check className="h-3.5 w-3.5 text-green-600" />;
    case "rejected":
      return <X className="h-3.5 w-3.5 text-red-600" />;
    case "skipped":
      return <SkipForward className="h-3.5 w-3.5 text-gray-400" />;
    default:
      return <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />;
  }
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const questionnaireId = params.id as string;
  const { toast } = useToast();

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editedAnswer, setEditedAnswer] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [showSaveToLibraryDialog, setShowSaveToLibraryDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [qRes, questionsRes] = await Promise.all([
        fetch(`/api/questionnaires/${questionnaireId}`),
        fetch(`/api/questionnaires/${questionnaireId}/questions`),
      ]);

      if (qRes.ok) {
        setQuestionnaire(await qRes.json());
      }
      if (questionsRes.ok) {
        const data: Question[] = await questionsRes.json();
        setQuestionsList(data);
        if (!selectedId && data.length > 0) {
          setSelectedId(data[0].id);
          setEditedAnswer(data[0].humanAnswer ?? data[0].aiAnswer ?? "");
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [questionnaireId, selectedId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll while processing
  useEffect(() => {
    if (questionnaire?.status !== "processing") return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [questionnaire?.status, fetchData]);

  const sections = useMemo(() => {
    const s = new Set<string>();
    questionsList.forEach((q) => {
      if (q.section) s.add(q.section);
    });
    return Array.from(s);
  }, [questionsList]);

  const filteredQuestions = useMemo(() => {
    return questionsList.filter((q) => {
      if (confidenceFilter !== "all" && q.confidence !== confidenceFilter) return false;
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          q.questionText.toLowerCase().includes(query) ||
          (q.section?.toLowerCase().includes(query) ?? false)
        );
      }
      return true;
    });
  }, [questionsList, confidenceFilter, statusFilter, searchQuery]);

  const selectedQuestion = questionsList.find((q) => q.id === selectedId);

  const currentIndex = filteredQuestions.findIndex((q) => q.id === selectedId);

  function selectQuestion(q: Question) {
    setSelectedId(q.id);
    setEditedAnswer(q.humanAnswer ?? q.aiAnswer ?? "");
  }

  function navigatePrev() {
    if (currentIndex > 0) {
      selectQuestion(filteredQuestions[currentIndex - 1]);
    }
  }

  function navigateNext() {
    if (currentIndex < filteredQuestions.length - 1) {
      selectQuestion(filteredQuestions[currentIndex + 1]);
    }
  }

  async function updateQuestion(
    questionId: string,
    updates: Record<string, unknown>
  ) {
    const res = await fetch(
      `/api/questionnaires/${questionnaireId}/questions`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, ...updates }),
      }
    );
    return res.ok;
  }

  async function handleApprove() {
    if (!selectedQuestion) return;
    setIsSaving(true);
    try {
      const ok = await updateQuestion(selectedQuestion.id, {
        status: "approved",
        humanAnswer: editedAnswer || selectedQuestion.aiAnswer,
      });
      if (ok) {
        toast({ title: "Answer approved" });
        await fetchData();
        navigateNext();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApproveAndSave() {
    if (!selectedQuestion) return;
    setShowSaveToLibraryDialog(true);
  }

  async function confirmSaveToLibrary() {
    if (!selectedQuestion) return;
    setIsSaving(true);
    try {
      // Approve the question
      const ok = await updateQuestion(selectedQuestion.id, {
        status: "approved",
        humanAnswer: editedAnswer || selectedQuestion.aiAnswer,
      });

      if (ok) {
        // Save to answer library
        await fetch("/api/answer-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionPattern: selectedQuestion.questionText,
            approvedAnswer: editedAnswer || selectedQuestion.aiAnswer,
          }),
        });

        toast({ title: "Answer approved and saved to library" });
        await fetchData();
        navigateNext();
      }
    } finally {
      setIsSaving(false);
      setShowSaveToLibraryDialog(false);
    }
  }

  async function handleReject() {
    if (!selectedQuestion) return;
    setIsSaving(true);
    try {
      const ok = await updateQuestion(selectedQuestion.id, {
        status: "rejected",
      });
      if (ok) {
        toast({ title: "Answer rejected" });
        await fetchData();
        navigateNext();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSkip() {
    if (!selectedQuestion) return;
    setIsSaving(true);
    try {
      const ok = await updateQuestion(selectedQuestion.id, {
        status: "skipped",
      });
      if (ok) {
        toast({ title: "Question skipped" });
        await fetchData();
        navigateNext();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!selectedQuestion) return;
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/questionnaires/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireId,
          questionIds: [selectedQuestion.id],
        }),
      });
      if (res.ok) {
        toast({ title: "Regenerating answer..." });
        // Poll for updates
        setTimeout(fetchData, 2000);
        setTimeout(fetchData, 5000);
      }
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleBulkApproveHighConfidence() {
    const highConfidenceIds = questionsList
      .filter((q) => q.confidence === "high" && q.status === "draft")
      .map((q) => q.id);

    if (highConfidenceIds.length === 0) {
      toast({ title: "No high-confidence draft answers to approve" });
      return;
    }

    setShowBulkApproveDialog(true);
  }

  async function confirmBulkApprove() {
    const highConfidenceIds = questionsList
      .filter((q) => q.confidence === "high" && q.status === "draft")
      .map((q) => q.id);

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/questionnaires/${questionnaireId}/questions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIds: highConfidenceIds,
            status: "approved",
          }),
        }
      );
      if (res.ok) {
        toast({
          title: `${highConfidenceIds.length} answers approved`,
        });
        await fetchData();
      }
    } finally {
      setIsSaving(false);
      setShowBulkApproveDialog(false);
    }
  }

  async function handleBulkAction(status: "approved" | "rejected" | "skipped") {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/questionnaires/${questionnaireId}/questions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIds: Array.from(selectedIds),
            status,
          }),
        }
      );
      if (res.ok) {
        toast({
          title: `${selectedIds.size} questions updated`,
        });
        setSelectedIds(new Set());
        await fetchData();
      }
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
    }
  }

  // Stats
  const totalQuestions = questionsList.length;
  const approvedCount = questionsList.filter((q) => q.status === "approved").length;
  const reviewedCount = questionsList.filter((q) => q.status !== "draft").length;
  const progressPct = totalQuestions > 0 ? Math.round((reviewedCount / totalQuestions) * 100) : 0;
  const allDraftCount = questionsList.filter((q) => q.status === "draft").length;

  async function handleExport(format: "xlsx" | "docx") {
    try {
      const res = await fetch(
        `/api/questionnaires/${questionnaireId}/export?format=${format}`
      );
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "Export failed",
          description: data.error ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match?.[1] ?? `export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded successfully" });
      await fetchData();
    } catch {
      toast({
        title: "Export failed",
        description: "Could not generate export.",
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-sm text-muted-foreground">Loading questionnaire...</p>
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-sm text-muted-foreground">Questionnaire not found</p>
        <Link href="/dashboard/questionnaires">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Questionnaires
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/questionnaires">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{questionnaire.name}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {approvedCount}/{totalQuestions} approved
              </span>
              <Progress value={progressPct} className="h-1.5 w-24" />
              <span>{progressPct}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkApproveHighConfidence}
            disabled={isSaving}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Approve All High Confidence
          </Button>

          {selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Bulk ({selectedIds.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkAction("approved")}>
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                  Approve Selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("rejected")}>
                  <X className="mr-2 h-4 w-4 text-red-600" />
                  Reject Selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("skipped")}>
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={allDraftCount > 0}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export as Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("docx")}>
                <FileText className="mr-2 h-4 w-4" />
                Export as Word (.docx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden mt-4 gap-4">
        {/* LEFT: Question list */}
        <div className="w-[380px] shrink-0 flex flex-col border rounded-lg overflow-hidden">
          {/* Filters */}
          <div className="p-3 border-b space-y-2 bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Filter className="mr-1 h-3 w-3" />
                    Confidence: {confidenceFilter === "all" ? "All" : confidenceFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(["all", "high", "medium", "low", "none"] as const).map((v) => (
                    <DropdownMenuItem
                      key={v}
                      onClick={() => setConfidenceFilter(v)}
                    >
                      {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Status: {statusFilter === "all" ? "All" : statusFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(["all", "draft", "approved", "rejected", "skipped"] as const).map(
                    (v) => (
                      <DropdownMenuItem
                        key={v}
                        onClick={() => setStatusFilter(v)}
                      >
                        {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === filteredQuestions.length &&
                    filteredQuestions.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="rounded"
                />
                Select all ({filteredQuestions.length})
              </label>
            </div>
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-y-auto">
            {filteredQuestions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No questions match your filters.
              </div>
            ) : (
              <>
                {sections.length > 0
                  ? sections
                      .filter((section) =>
                        filteredQuestions.some((q) => q.section === section)
                      )
                      .map((section) => (
                        <div key={section}>
                          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b sticky top-0">
                            {section}
                          </div>
                          {filteredQuestions
                            .filter((q) => q.section === section)
                            .map((q) => (
                              <QuestionListItem
                                key={q.id}
                                question={q}
                                isSelected={q.id === selectedId}
                                isChecked={selectedIds.has(q.id)}
                                onSelect={() => selectQuestion(q)}
                                onToggle={() => toggleSelect(q.id)}
                              />
                            ))}
                        </div>
                      ))
                  : filteredQuestions.map((q) => (
                      <QuestionListItem
                        key={q.id}
                        question={q}
                        isSelected={q.id === selectedId}
                        isChecked={selectedIds.has(q.id)}
                        onSelect={() => selectQuestion(q)}
                        onToggle={() => toggleSelect(q.id)}
                      />
                    ))}
                {/* Also render questions with no section */}
                {sections.length > 0 &&
                  filteredQuestions.filter((q) => !q.section).length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b sticky top-0">
                        Uncategorized
                      </div>
                      {filteredQuestions
                        .filter((q) => !q.section)
                        .map((q) => (
                          <QuestionListItem
                            key={q.id}
                            question={q}
                            isSelected={q.id === selectedId}
                            isChecked={selectedIds.has(q.id)}
                            onSelect={() => selectQuestion(q)}
                            onToggle={() => toggleSelect(q.id)}
                          />
                        ))}
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Question detail */}
        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
          {selectedQuestion ? (
            <>
              {/* Navigation */}
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} of {filteredQuestions.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={navigatePrev}
                    disabled={currentIndex <= 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={navigateNext}
                    disabled={currentIndex >= filteredQuestions.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Question */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div>
                  {selectedQuestion.section && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {selectedQuestion.section}
                    </p>
                  )}
                  <h2 className="text-base font-medium leading-relaxed">
                    {selectedQuestion.questionText}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <ConfidenceBadge confidence={selectedQuestion.confidence} />
                    <Badge variant="outline" className="text-xs">
                      {selectedQuestion.answerFormat === "yes_no"
                        ? "Yes/No"
                        : selectedQuestion.answerFormat === "multiple_choice"
                          ? "Multiple Choice"
                          : "Free Text"}
                    </Badge>
                    {selectedQuestion.status !== "draft" && (
                      <Badge
                        variant="secondary"
                        className={
                          selectedQuestion.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : selectedQuestion.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-600"
                        }
                      >
                        {selectedQuestion.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* AI answer */}
                {selectedQuestion.aiAnswer && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      AI-Generated Answer
                    </label>
                    <div className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-wrap border">
                      {selectedQuestion.aiAnswer}
                    </div>
                  </div>
                )}

                {/* Editable answer */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Final Answer (editable)
                  </label>
                  <textarea
                    value={editedAnswer}
                    onChange={(e) => setEditedAnswer(e.target.value)}
                    className="w-full min-h-[120px] rounded-md border bg-background p-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Edit the answer or write your own..."
                  />
                </div>

                {/* Source chunks info */}
                {selectedQuestion.sourceChunkIds &&
                  (selectedQuestion.sourceChunkIds as string[]).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Based on {(selectedQuestion.sourceChunkIds as string[]).length} source
                        document chunk(s) from your knowledge base.
                      </p>
                    </div>
                  )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApproveAndSave}
                    disabled={isSaving}
                  >
                    <LibraryBig className="mr-1 h-3.5 w-3.5" />
                    Approve & Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReject}
                    disabled={isSaving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                  >
                    <RefreshCw
                      className={`mr-1 h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`}
                    />
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    disabled={isSaving}
                  >
                    <SkipForward className="mr-1 h-3.5 w-3.5" />
                    Skip
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a question from the list to review.
            </div>
          )}
        </div>
      </div>

      {/* Bulk approve dialog */}
      <Dialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve All High Confidence</DialogTitle>
            <DialogDescription>
              This will approve{" "}
              {
                questionsList.filter(
                  (q) => q.confidence === "high" && q.status === "draft"
                ).length
              }{" "}
              high-confidence draft answers. Their AI-generated answers will be
              accepted as final. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkApproveDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={confirmBulkApprove} disabled={isSaving}>
              {isSaving ? "Approving..." : "Approve All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save to library dialog */}
      <Dialog
        open={showSaveToLibraryDialog}
        onOpenChange={setShowSaveToLibraryDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Answer Library</DialogTitle>
            <DialogDescription>
              This will approve the answer and save it to your answer library for
              automatic reuse in future questionnaires. The question pattern will
              be used to match similar questions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveToLibraryDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={confirmSaveToLibrary} disabled={isSaving}>
              {isSaving ? "Saving..." : "Approve & Save to Library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

function QuestionListItem({
  question,
  isSelected,
  isChecked,
  onSelect,
  onToggle,
}: {
  question: Question;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 border-b cursor-pointer transition-colors ${
        isSelected
          ? "bg-accent"
          : "hover:bg-muted/50"
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="mt-1 rounded shrink-0"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0" onClick={onSelect}>
        <p className="text-sm leading-snug line-clamp-2">
          {question.questionText}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <StatusIcon status={question.status} />
          <ConfidenceBadge confidence={question.confidence} />
        </div>
      </div>
    </div>
  );
}
