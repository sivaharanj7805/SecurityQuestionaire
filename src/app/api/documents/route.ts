import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized. Please select an organization." },
        { status: 401 }
      );
    }

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.orgId, orgId))
      .orderBy(desc(documents.createdAt));

    return NextResponse.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents." },
      { status: 500 }
    );
  }
}
