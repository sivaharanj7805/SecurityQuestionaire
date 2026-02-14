import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getLibraryEntries,
  addToLibrary,
  updateLibraryEntry,
  deleteLibraryEntry,
} from "@/lib/actions/answer-library";

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
    const { questionPattern, approvedAnswer, sourceDocIds } = body as {
      questionPattern: string;
      approvedAnswer: string;
      sourceDocIds?: string[];
    };

    if (!questionPattern || !approvedAnswer) {
      return NextResponse.json(
        { error: "questionPattern and approvedAnswer are required" },
        { status: 400 }
      );
    }

    const entry = await addToLibrary({
      questionPattern,
      approvedAnswer,
      sourceDocIds,
    });

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
    const { entryId, questionPattern, approvedAnswer } = body as {
      entryId: string;
      questionPattern?: string;
      approvedAnswer?: string;
    };

    if (!entryId) {
      return NextResponse.json(
        { error: "entryId is required" },
        { status: 400 }
      );
    }

    await updateLibraryEntry(entryId, { questionPattern, approvedAnswer });
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
