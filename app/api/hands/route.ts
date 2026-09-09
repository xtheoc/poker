import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MissingTableError, deleteHands } from "@/lib/hands-store";
import { optionalUser } from "@/lib/session";

/**
 * Remove hands.
 *
 * One endpoint for a single hand and for a whole sitting, because a session is
 * only ever a list of hand ids — sittings are derived from the gaps between
 * timestamps rather than stored, so there is no session row to delete. The
 * caller sends the ids it wants gone.
 *
 * The confirmation belongs in the interface, where the count and the date can
 * be put in front of you. A route that simply obeys is the right shape for the
 * server half of a destructive action.
 */

const Body = z.object({
  // Generous, because deleting a long sitting is a legitimate single request,
  // and bounded, because an unbounded delete is not something to accept from a
  // client.
  handIds: z.array(z.string().min(1).max(64)).min(1).max(5000),
});

export async function POST(request: Request) {
  const session = await optionalUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That did not look right." },
      { status: 400 },
    );
  }

  try {
    const removed = await deleteHands(
      session.supabase,
      session.userId,
      parsed.data.handIds,
    );

    // Accuracy, leaks and the nav dot all move when hands disappear.
    revalidatePath("/hands");
    revalidatePath("/drill");

    return NextResponse.json({ removed });
  } catch (error) {
    if (error instanceof MissingTableError) {
      return NextResponse.json(
        {
          error:
            "The hand tables do not exist yet. Run supabase/migrations/0003_hands.sql, then try again.",
        },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not remove those hands.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
