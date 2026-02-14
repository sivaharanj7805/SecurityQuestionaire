"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

interface DocumentDetail {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  fileKey: string;
  status: "processing" | "ready" | "failed";
  pageCount: number | null;
  createdAt: string;
}

interface Chunk {
  id: string;
  chunkText: string;
  chunkIndex: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ChunksResponse {
  chunks: Chunk[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: DocumentDetail["status"] }) {
  switch (status) {
    case "processing":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          Processing
        </Badge>
      );
    case "ready":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Ready
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
  }
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [chunksData, setChunksData] = useState<ChunksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${params.id}`);
      if (res.ok) {
        setDocument(await res.json());
      } else {
        toast({
          title: "Error",
          description: "Document not found.",
          variant: "destructive",
        });
        router.push("/dashboard/knowledge-base");
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load document.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [params.id, router, toast]);

  const fetchChunks = useCallback(
    async (page: number) => {
      try {
        const res = await fetch(
          `/api/documents/${params.id}/chunks?page=${page}&pageSize=20`
        );
        if (res.ok) {
          setChunksData(await res.json());
        }
      } catch {
        // silently fail
      }
    },
    [params.id]
  );

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  useEffect(() => {
    fetchChunks(currentPage);
  }, [fetchChunks, currentPage]);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${params.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({
          title: "Document deleted",
          description: "The document has been permanently removed.",
        });
        router.push("/dashboard/knowledge-base");
      } else {
        throw new Error("Delete failed");
      }
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not delete the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/knowledge-base">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">
              {document.filename}
            </h1>
            <StatusBadge status={document.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast({
                title: "Re-processing",
                description: "Document has been queued for re-processing.",
              });
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-process
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                File Type
              </p>
              <p className="mt-1 text-sm uppercase">{document.fileType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                File Size
              </p>
              <p className="mt-1 text-sm">
                {formatFileSize(document.fileSize)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Pages
              </p>
              <p className="mt-1 text-sm">
                {document.pageCount ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Uploaded
              </p>
              <p className="mt-1 text-sm">
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(document.createdAt))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chunks */}
      <Card>
        <CardHeader>
          <CardTitle>
            Extracted Chunks
            {chunksData && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({chunksData.total} total)
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Text chunks extracted from this document for AI search and matching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!chunksData || chunksData.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {document.status === "processing"
                  ? "Chunks are being extracted. This page will update when processing is complete."
                  : "No chunks have been extracted from this document."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {chunksData.chunks.map((chunk) => (
                <div key={chunk.id}>
                  <div className="rounded-md border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Chunk #{chunk.chunkIndex + 1}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {chunk.chunkText}
                    </p>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {chunksData.totalPages > 1 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {chunksData.page} of {chunksData.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= chunksData.totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{document.filename}&rdquo;?
              This will permanently remove the document and all its extracted
              chunks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
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
