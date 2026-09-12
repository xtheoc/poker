import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { MissingTableError, importHands } from "@/lib/hands-store";
import { BEGINNER_6MAX } from "@/lib/poker/charts/beginner-6max";
import { optionalUser } from "@/lib/session";
import { getAllStrategies } from "@/lib/strategies";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import {
  MissingStrategyDecisionTablesError,
  MissingStrategyReviewTablesError,
} from "@/lib/strategies/hand-review";

/**
 * Import a hand-history file.
 *
 * Takes raw text and parses it here rather than accepting parsed hands from the
 * browser. Two reasons, and the second is the one that matters: the client
 * would otherwise be grading its own play, which is the wrong shape for the one
 * thing this app has to be honest about; and the raw text is what gets stored,
 * so parsing server-side makes the import path and a future re-parse of stored
 * hands the *same* code. A parser fix six months from now then replays over old
 * imports instead of only helping new ones.
 *
 * Nothing here reads live game state. This runs after a session, over files
 * PokerStars itself wrote, which is the only shape of tool its policy permits.
 */

/**
 * Body cap, in characters.
 *
 * A hand is roughly 1.5 KB, so this is around five thousand hands — several
 * months at this volume. The client splits larger files rather than relying on
 * the cap, but a server that will accept an unbounded string is a server that
 * will eventually be handed one.
 */
const MAX_CHARS = 8_000_000;

const Body = z.object({
  text: z.string().min(1).max(MAX_CHARS),
});

/**
 * Browser imports use the signed-in cookie. The local watcher refreshes a
 * personal Supabase session and sends its short-lived access token instead.
 * Both paths receive the same RLS-bound client, so automatic import can only
 * ever write the connected user's rows; no database-wide key is involved.
 */
async function importSession(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return optionalUser();

  const accessToken = authorization.slice("Bearer ".length);
  const env = requireSupabaseEnv();
  const supabase = createSupabaseClient(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);
  return user ? { supabase, userId: user.id } : null;
}

export async function POST(request: Request) {
  // A plain 401 rather than a redirect: this is called by fetch, and a redirect
  // would hand it an HTML login page to parse as JSON.
  const session = await importSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Sign in first — there is nowhere to save these otherwise." },
      { status: 401 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That file was empty, or too large to import in one go." },
      { status: 400 },
    );
  }

  try {
    const summary = await importHands(
      session.supabase,
      session.userId,
      parsed.data.text,
      BEGINNER_6MAX,
      { strategies: getAllStrategies() },
    );

    // The session list and the daily queue are server-rendered, so they have to
    // be told the rows underneath them moved.
    revalidatePath("/hands");
    revalidatePath("/today");
    for (const strategy of getAllStrategies()) {
      revalidatePath(`/strategies/${strategy.id}`);
      revalidatePath(`/strategies/${strategy.id}/hands`);
    }

    return NextResponse.json({
      parsed: summary.parsed,
      stored: summary.stored,
      duplicates: summary.duplicates,
      charted: summary.charted,
      mistakes: summary.mistakes,
      latestHandId: summary.latestHandId,
      strategyReviewed: summary.strategyReviewed,
      // Reasons only. The unreadable text itself is not worth sending back, and
      // the count is what tells you whether to care.
      unparsed: summary.unparsed.length,
      unparsedReasons: [...new Set(summary.unparsed.map((u) => u.reason))].slice(
        0,
        5,
      ),
    });
  } catch (error) {
    // The one failure with a specific fix gets the instruction rather than the
    // symptom — otherwise the first import anybody ever runs reports a bug.
    if (error instanceof MissingTableError) {
      return NextResponse.json(
        {
          error:
            "The hand tables do not exist yet. Run supabase/migrations/0003_hands.sql in the Supabase SQL editor, then try again.",
        },
        { status: 503 },
      );
    }
    if (error instanceof MissingStrategyReviewTablesError) {
      return NextResponse.json(
        {
          error:
            "Hands were saved, but strategy review is not set up yet. Run supabase/migrations/0010_strategy_hand_reviews.sql, then import again.",
        },
        { status: 503 },
      );
    }
    if (error instanceof MissingStrategyDecisionTablesError) {
      return NextResponse.json(
        {
          error:
            "Hands were saved, but decision coverage is not set up yet. Run supabase/migrations/0011_strategy_decisions.sql, then import again.",
        },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not import those hands.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
