"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileText, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

type AnswerFormat = "freetext" | "yes_no" | "multiple_choice";

interface ParsedQuestion {
  section: string;
  questionText: string;
  answerFormat: AnswerFormat;
  rowIndex: number;
}

type Step = "upload" | "preview" | "processing";

// Estimated cost: ~$0.003 per freetext question (Sonnet), ~$0.001 per yes_no (Haiku)
function estimateCost(questions: ParsedQuestion[]): string {
  let cost = 0;
  for (const q of questions) {
    cost += q.answerFormat === "yes_no" ? 0.001 : 0.003;
  }
  return cost.toFixed(2);
}

export default function ImportQuestionnairePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [filename, setFilename] = useState("");
  const [questionnaireName, setQuestionnaireName] = useState("");
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Processing state
  const [questionnaireId, setQuestionnaireId] = useState<string | null>(null);
  const [processTotal, setProcessTotal] = useState(0);
  const [processCompleted, setProcessCompleted] = useState(0);
  const [processStatus, setProcessStatus] = useState<string>("processing");

  const parseFile = useCallback(
    async (file: File) => {
      if (
        file.type !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        toast({
          title: "Invalid file",
          description: "Only XLSX files are supported for questionnaire import.",
          variant: "destructive",
        });
        return;
      }

      setIsParsing(true);
      setFilename(file.name);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/questionnaires/parse", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to parse file");
        }

        const data = await res.json();
        setQuestions(data.questions);
        setQuestionnaireName(
          file.name.replace(/\.(xlsx|xls)$/i, "")
        );
        setStep("preview");
      } catch (err) {
        toast({
          title: "Parse failed",
          description:
            err instanceof Error ? err.message : "Could not parse the file.",
          variant: "destructive",
        });
      } finally {
        setIsParsing(false);
      }
    },
    [toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files[0]) parseFile(files[0]);
    },
    [parseFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
      e.target.value = "";
    },
    [parseFile]
  );

  function removeQuestion(rowIndex: number) {
    setQuestions((prev) => prev.filter((q) => q.rowIndex !== rowIndex));
  }

  function updateFormat(rowIndex: number, format: AnswerFormat) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.rowIndex === rowIndex ? { ...q, answerFormat: format } : q
      )
    );
  }

  function updateText(rowIndex: number, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.rowIndex === rowIndex ? { ...q, questionText: text } : q
      )
    );
  }

  async function handleProcessWithAI() {
    if (questions.length === 0 || !questionnaireName.trim()) return;

    setIsCreating(true);

    try {
      // 1. Create questionnaire with questions
      const createRes = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: questionnaireName.trim(),
          questions: questions.map((q) => ({
            section: q.section,
            questionText: q.questionText,
            answerFormat: q.answerFormat,
          })),
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || "Failed to create questionnaire");
      }

      const questionnaire = await createRes.json();
      setQuestionnaireId(questionnaire.id);
      setProcessTotal(questions.length);
      setProcessCompleted(0);
      setProcessStatus("processing");
      setStep("processing");

      // 2. Start batch processing
      const processRes = await fetch("/api/questionnaires/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaireId: questionnaire.id }),
      });

      if (!processRes.ok) {
        const data = await processRes.json();
        throw new Error(data.error || "Failed to start processing");
      }
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  }

  // Poll progress during processing
  useEffect(() => {
    if (step !== "processing" || !questionnaireId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/questionnaires/${questionnaireId}/progress`
        );
        if (res.ok) {
          const data = await res.json();
          setProcessCompleted(data.completed);
          setProcessTotal(data.total);
          setProcessStatus(data.status);

          if (data.status !== "processing") {
            clearInterval(interval);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [step, questionnaireId]);

  const yesNoCount = questions.filter(
    (q) => q.answerFormat === "yes_no"
  ).length;
  const freetextCount = questions.length - yesNoCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/questionnaires">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Import Questionnaire
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload an Excel spreadsheet containing security questions.
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {(["upload", "preview", "processing"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && (
              <Separator className="w-8" orientation="horizontal" />
            )}
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                step === s
                  ? "bg-primary text-primary-foreground"
                  : (["upload", "preview", "processing"].indexOf(step) > i)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                step === s ? "font-medium" : "text-muted-foreground"
              )}
            >
              {s === "upload"
                ? "Upload"
                : s === "preview"
                  ? "Preview & Edit"
                  : "Processing"}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Questionnaire File</CardTitle>
            <CardDescription>
              Upload an Excel spreadsheet (.xlsx) containing your security
              questionnaire. We&apos;ll automatically detect questions from
              columns named &quot;Question&quot;, &quot;Requirement&quot;, or
              &quot;Control&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={isParsing}
              />
              {isParsing ? (
                <>
                  <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium">
                    Parsing {filename}...
                  </p>
                </>
              ) : (
                <>
                  <Upload
                    className={cn(
                      "mb-4 h-10 w-10",
                      isDragging ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <p className="text-sm font-medium">
                    {isDragging
                      ? "Drop file here"
                      : "Drag & drop an XLSX file, or click to browse"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Excel spreadsheets (.xlsx) only
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview & Edit */}
      {step === "preview" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Questionnaire Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Questionnaire Name</Label>
                  <Input
                    id="name"
                    value={questionnaireName}
                    onChange={(e) => setQuestionnaireName(e.target.value)}
                    className="mt-1.5 max-w-md"
                  />
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>
                    Source: <strong>{filename}</strong>
                  </span>
                  <span>
                    Questions: <strong>{questions.length}</strong>
                  </span>
                  <span>
                    Yes/No: <strong>{yesNoCount}</strong>
                  </span>
                  <span>
                    Free text: <strong>{freetextCount}</strong>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Extracted Questions ({questions.length})
                </CardTitle>
                <Button onClick={() => setStep("upload")} variant="outline" size="sm">
                  Re-upload
                </Button>
              </div>
              <CardDescription>
                Review and edit the extracted questions. Remove any that
                aren&apos;t relevant and adjust the answer format as needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No questions remaining. Upload a new file.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="w-10 px-3 py-2 text-left text-xs font-medium">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium">
                            Section
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium">
                            Question
                          </th>
                          <th className="w-32 px-3 py-2 text-left text-xs font-medium">
                            Format
                          </th>
                          <th className="w-10 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q, i) => (
                          <tr
                            key={q.rowIndex}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-muted-foreground">
                                {q.section || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={q.questionText}
                                onChange={(e) =>
                                  updateText(q.rowIndex, e.target.value)
                                }
                                className="w-full border-0 bg-transparent text-sm outline-none focus:ring-0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={q.answerFormat}
                                onChange={(e) =>
                                  updateFormat(
                                    q.rowIndex,
                                    e.target.value as AnswerFormat
                                  )
                                }
                                className="h-7 rounded border bg-transparent px-1 text-xs"
                              >
                                <option value="freetext">Free text</option>
                                <option value="yes_no">Yes/No</option>
                                <option value="multiple_choice">
                                  Multiple choice
                                </option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeQuestion(q.rowIndex)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {questions.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
              <div className="text-sm">
                <p className="font-medium">
                  Ready to process {questions.length} questions with AI
                </p>
                <p className="text-muted-foreground">
                  Estimated cost: ~${estimateCost(questions)}
                </p>
              </div>
              <Button
                onClick={handleProcessWithAI}
                disabled={isCreating || !questionnaireName.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Process with AI
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Step 3: Processing */}
      {step === "processing" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {processStatus === "processing"
                ? "Processing Questions..."
                : "Processing Complete"}
            </CardTitle>
            <CardDescription>
              {processStatus === "processing"
                ? "Each question is being analyzed against your knowledge base. This may take a few minutes."
                : "All questions have been processed. You can now review the AI-generated answers."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {processStatus === "processing" ? (
                    <>
                      Processing question{" "}
                      <strong>{processCompleted + 1}</strong> of{" "}
                      <strong>{processTotal}</strong>...
                    </>
                  ) : (
                    <>
                      Processed <strong>{processCompleted}</strong> of{" "}
                      <strong>{processTotal}</strong> questions
                    </>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {processTotal > 0
                    ? Math.round((processCompleted / processTotal) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={
                  processTotal > 0
                    ? (processCompleted / processTotal) * 100
                    : 0
                }
              />
            </div>

            {processStatus === "processing" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  AI is generating answers using your knowledge base...
                </span>
              </div>
            )}

            {processStatus !== "processing" && questionnaireId && (
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  Complete
                </Badge>
                <Button
                  onClick={() =>
                    router.push(
                      `/dashboard/questionnaires/${questionnaireId}`
                    )
                  }
                >
                  Review Answers
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  );
}
