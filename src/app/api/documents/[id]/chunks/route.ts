import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { chunks } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: documentId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10))
    );
    const offset = (page - 1) * pageSize;

    const [chunkList, totalResult] = await Promise.all([
      db
        .select({
          id: chunks.id,
          chunkText: chunks.chunkText,
          chunkIndex: chunks.chunkIndex,
          metadata: chunks.metadata,
          createdAt: chunks.createdAt,
        })
        .from(chunks)
        .where(
          and(
            eq(chunks.documentId, documentId),
            eq(chunks.orgId, orgId)
          )
        )
        .orderBy(chunks.chunkIndex)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: count() })
        .from(chunks)
        .where(
          and(
            eq(chunks.documentId, documentId),
            eq(chunks.orgId, orgId)
          )
        ),
    ]);

    return NextResponse.json({
      chunks: chunkList,
      total: totalResult[0].count,
      page,
      pageSize,
      totalPages: Math.ceil(totalResult[0].count / pageSize),
    });
  } catch (error) {
    console.error("Error fetching chunks:", error);
    return NextResponse.json(
      { error: "Failed to fetch chunks." },
      { status: 500 }
    );
  }
}
