"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDropzone } from "@/components/knowledge-base/upload-dropzone";
import { DocumentTable } from "@/components/knowledge-base/document-table";
import { Toaster } from "@/components/ui/toaster";

interface Document {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: "processing" | "ready" | "failed";
  pageCount: number | null;
  createdAt: Date;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch {
      // silently fail on fetch — documents will show as empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for status changes when documents are processing
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Upload and manage your security documentation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadDropzone onUploadComplete={fetchDocuments} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                Loading documents...
              </p>
            </div>
          ) : (
            <DocumentTable
              documents={documents}
              onDocumentDeleted={fetchDocuments}
            />
          )}
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}
