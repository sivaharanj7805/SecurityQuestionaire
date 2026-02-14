import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { seedDemoData } from "@/lib/demo/seed";

export async function POST() {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up internal org and user IDs
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.clerkOrgId, orgId));

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, userId));

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const result = await seedDemoData(org.id, user.id);

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      questionnaireId: result.questionnaireId,
    });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    return NextResponse.json(
      { error: "Failed to create sample data" },
      { status: 500 }
    );
  }
}
