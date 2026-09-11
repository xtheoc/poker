import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  MissingStrategyDecisionTablesError,
  MissingStrategyReviewTablesError,
  rebuildStrategyHandReviews,
} from "@/lib/strategies/hand-review";
import { getLearningStrategy } from "@/lib/strategies";
import { optionalUser } from "@/lib/session";

/** Replay existing imported hands against one strategy without touching global review. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ strategyId: string }> },
) {
  const { strategyId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) return NextResponse.json({ error: "Unknown strategy." }, { status: 404 });

  const session = await optionalUser();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  try {
    const summary = await rebuildStrategyHandReviews(
      session.supabase,
      session.userId,
      strategy,
    );
    revalidatePath(`/strategies/${strategy.id}`);
    revalidatePath(`/strategies/${strategy.id}/hands`);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof MissingStrategyReviewTablesError) {
      return NextResponse.json(
        {
          error:
            "Run supabase/migrations/0010_strategy_hand_reviews.sql in Supabase, then review again.",
        },
        { status: 503 },
      );
    }
    if (error instanceof MissingStrategyDecisionTablesError) {
      return NextResponse.json(
        { error: "Run supabase/migrations/0011_strategy_decisions.sql, then review again." },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "Could not review those hands.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
