import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { MissingTableError, regradeHands } from "@/lib/hands-store";
import { BEGINNER_6MAX } from "@/lib/poker/charts/beginner-6max";
import { optionalUser } from "@/lib/session";
import { getAllStrategies } from "@/lib/strategies";
import {
  MissingStrategyDecisionTablesError,
  MissingStrategyReviewTablesError,
} from "@/lib/strategies/hand-review";

/**
 * Re-grade every stored hand against the chart set the server is running now.
 *
 * Needed because a verdict is not a property of a hand, it is a property of a
 * hand *and* the chart that judged it. When ranges change, history keeps its
 * old verdicts — deliberately, so nothing is silently re-scored against numbers
 * you were never shown — and this is the button that says "yes, judge it all
 * again with the new ones".
 *
 * Deliberately not automatic on deploy. Re-grading rewrites what the app thinks
 * your mistakes are, and that should happen because you asked, not because a
 * build shipped.
 *
 * No request body: there is exactly one current chart set, and letting a client
 * choose which one to grade against would make "your accuracy" a number that
 * depends on who asked.
 */
export async function POST() {
  const session = await optionalUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  try {
    const summary = await regradeHands(
      session.supabase,
      session.userId,
      BEGINNER_6MAX,
      { strategies: getAllStrategies() },
    );

    // Accuracy, leaks, the trend and the nav dot all move at once.
    revalidatePath("/hands");
    revalidatePath("/drill");
    revalidatePath("/settings");
    for (const strategy of getAllStrategies()) {
      revalidatePath(`/strategies/${strategy.id}`);
      revalidatePath(`/strategies/${strategy.id}/hands`);
    }

    return NextResponse.json(summary);
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
    if (error instanceof MissingStrategyReviewTablesError) {
      return NextResponse.json(
        {
          error:
            "Run supabase/migrations/0010_strategy_hand_reviews.sql, then re-grade again.",
        },
        { status: 503 },
      );
    }
    if (error instanceof MissingStrategyDecisionTablesError) {
      return NextResponse.json(
        {
          error:
            "Run supabase/migrations/0011_strategy_decisions.sql, then re-grade again.",
        },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not re-grade your hands.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
