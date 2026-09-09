import { NextResponse } from "next/server";
import { z } from "zod";
import { type CardRow, ensureNodeCards, recordReview, toCard } from "@/lib/cards";
import { BEGINNER_6MAX } from "@/lib/poker/charts/beginner-6max";
import { optionalUser } from "@/lib/session";
import { type DrillResult, sessionRating } from "@/lib/srs";

/**
 * Record a finished drill.
 *
 * Takes a list of reviews rather than one, because the quickfire drill deals
 * random spots and a single run touches a dozen different nodes. Each node is
 * one card and gets its own rating, computed from just the hands belonging to
 * it — a card must not be marked down for a mistake made at a different spot.
 *
 * The client sends what happened; the server decides what it means. Grading is
 * deterministic and the client already did it to show feedback, but the rating
 * is computed here so the scheduling rules live in exactly one place.
 */

const HandResult = z.object({
  hand: z.string().min(2).max(3),
  chosenAction: z.enum(["fold", "call", "raise", "allin"]),
  expectedAction: z.enum(["fold", "call", "raise", "allin"]),
  grade: z.enum(["best", "correct", "inaccuracy", "wrong", "blunder"]),
  score: z.number().min(-1).max(1),
  strategyFreq: z.number().min(0).max(1),
  evLossBb: z.number().optional(),
  rngRoll: z.number().int().min(1).max(100).optional(),
  durationMs: z.number().int().min(0).max(3_600_000),
});

const Body = z.object({
  reviews: z
    .array(
      z.object({
        itemKey: z.string().min(1).max(200),
        hands: z.array(HandResult).min(1).max(50),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  // A plain 401 rather than a redirect. The drill posts in the background and
  // treats this as "not signed in, nothing to save" — a redirect would hand it
  // an HTML login page to parse as JSON.
  const session = await optionalUser();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That drill result did not look right." },
      { status: 400 },
    );
  }

  // Seeding here rather than at signup means a chart set that grows later gives
  // existing users the new nodes without a migration. It never touches a row
  // that already exists.
  await ensureNodeCards(session.supabase, session.userId, BEGINNER_6MAX);

  const keys = parsed.data.reviews.map((r) => r.itemKey);
  const { data, error } = await session.supabase
    .from("srs_card")
    .select("*")
    .eq("user_id", session.userId)
    .eq("kind", "preflop_node")
    .in("item_key", keys);

  if (error) {
    return NextResponse.json({ error: "Could not load your cards." }, { status: 500 });
  }

  const rows = new Map(
    ((data ?? []) as unknown as CardRow[]).map((row) => [row.item_key, row]),
  );

  let saved = 0;
  const skipped: string[] = [];

  for (const entry of parsed.data.reviews) {
    const row = rows.get(entry.itemKey);
    // A spot with no card is one the chart set no longer contains. Skipping it
    // beats failing a whole session over a node that has since been renamed.
    if (!row) {
      skipped.push(entry.itemKey);
      continue;
    }

    const results: DrillResult[] = entry.hands.map((h) => ({
      grade: h.grade,
      score: h.score,
      durationMs: h.durationMs,
    }));

    await recordReview(
      session.supabase,
      session.userId,
      row,
      sessionRating(results, toCard(row)),
      entry.hands,
    );
    saved++;
  }

  return NextResponse.json({ saved, skipped });
}
