"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

let uploadIdCounter = 0;

interface UploadDropzoneProps {
  onUploadComplete: () => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "ingesting" | "complete" | "error";
  error?: string;
}

export function UploadDropzone({ onUploadComplete }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const { toast } = useToast();
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return "File type not allowed. Only PDF, DOCX, and XLSX files are accepted.";
      }
      if (file.size > MAX_FILE_SIZE) {
        return "File size exceeds 50MB limit.";
      }
      return null;
    },
    []
  );

  const updateUpload = useCallback(
    (uploadId: string, updates: Partial<UploadingFile>) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === uploadId ? { ...u, ...updates } : u))
      );
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast({ title: "Upload failed", description: error, variant: "destructive" });
        return;
      }

      const uploadId = `upload-${++uploadIdCounter}`;
      const uploadEntry: UploadingFile = {
        id: uploadId,
        file,
        progress: 0,
        status: "uploading",
      };

      setUploads((prev) => [...prev, uploadEntry]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();

        const responseData = await new Promise<{ id: string }>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              updateUpload(uploadId, { progress: percent });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateUpload(uploadId, { progress: 100 });
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                resolve({ id: "" });
              }
            } else {
              try {
                const body = JSON.parse(xhr.responseText);
                reject(new Error(body.error || "Upload failed"));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Network error during upload"));
          });

          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        // Trigger ingestion as a separate synchronous request
        if (responseData.id) {
          updateUpload(uploadId, { status: "ingesting" });
          const ingestRes = await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: responseData.id }),
          });

          if (!ingestRes.ok) {
            const ingestData = await ingestRes.json().catch(() => ({}));
            console.error("Ingestion failed:", ingestData.error);
            // Don't fail the upload, just log it — the document can be reprocessed
          }
        }

        updateUpload(uploadId, { status: "complete", progress: 100 });
        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded and processed.`,
        });
        onUploadComplete();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        updateUpload(uploadId, { status: "error", error: message });
        toast({
          title: "Upload failed",
          description: message,
          variant: "destructive",
        });
      }
    },
    [validateFile, toast, onUploadComplete, updateUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      files.forEach(uploadFile);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      files.forEach(uploadFile);
      e.target.value = "";
    },
    [uploadFile]
  );

  const removeUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input
          type="file"
          accept=".pdf,.docx,.xlsx"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <Upload
          className={cn(
            "mb-4 h-10 w-10",
            isDragging ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium">
          {isDragging
            ? "Drop files here"
            : "Drag & drop files here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOCX, XLSX up to 50MB
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {upload.file.name}
                </p>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="mt-1" />
                )}
                {upload.status === "ingesting" && (
                  <p className="mt-1 text-xs text-blue-600">
                    Processing document...
                  </p>
                )}
                {upload.status === "error" && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {upload.error}
                  </p>
                )}
                {upload.status === "complete" && (
                  <p className="mt-1 text-xs text-green-600">
                    Upload complete
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeUpload(upload.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
