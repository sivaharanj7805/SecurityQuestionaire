import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  getLibraryEntries,
  addToLibrary,
  updateLibraryEntry,
  deleteLibraryEntry,
} from "@/lib/actions/answer-library";

const addSchema = z.object({
  questionPattern: z.string().min(1).max(5000),
  approvedAnswer: z.string().min(1).max(10000),
  sourceDocIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  entryId: z.string().uuid(),
  questionPattern: z.string().min(1).max(5000).optional(),
  approvedAnswer: z.string().min(1).max(10000).optional(),
});

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await getLibraryEntries();
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching answer library:", error);
    return NextResponse.json(
      { error: "Failed to fetch answer library" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = addSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const entry = await addToLibrary(validation.data);

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error adding to answer library:", error);
    return NextResponse.json(
      { error: "Failed to add to answer library" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { entryId, ...updates } = validation.data;
    await updateLibraryEntry(entryId, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating answer library entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("id");

    if (!entryId) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    await deleteLibraryEntry(entryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting answer library entry:", error);
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 }
    );
  }
}
