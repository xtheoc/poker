/**
 * Cards, as they live in the database.
 *
 * The scheduler in `srs.ts` is pure and knows nothing about storage; this is the
 * layer mapping its state onto rows and back. Keeping them apart matters
 * because the scheduling rules are the part worth testing exhaustively, and
 * they should not need a database to be tested.
 *
 * Two invariants this module exists to protect:
 *
 * **The review log is append-only.** It is the training set for fitting this
 * user's own FSRS parameters later, and what a reschedule replays. Nothing here
 * ever updates or deletes a log row — the table has no policy permitting it
 * either, so the rule is enforced rather than merely intended.
 *
 * **A card is identified by what it teaches, not by which chart version taught
 * it.** `item_key` holds a node id describing a *situation*; publishing better
 * numbers for that situation leaves six months of review history intact.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type ChartSet, nodeId } from "./poker/charts";
import { type Card, type Grade, type State, newCard, review } from "./srs";

export type CardKind = "preflop_node" | "hand_replay" | "concept" | "leak_drill";

/** A card row as stored, before it becomes a ts-fsrs Card. */
export interface CardRow {
  id: string;
  kind: CardKind;
  item_key: string;
  chart_version: number | null;
  payload: Record<string, unknown>;
  source_leak_id: string | null;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  suspended: boolean;
  retired_at: string | null;
}

const CARD_COLUMNS =
  "id, kind, item_key, chart_version, payload, source_leak_id, due, stability, " +
  "difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, " +
  "state, last_review, suspended, retired_at";

/** A stored row as the scheduler wants to see it. */
export function toCard(row: CardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

/** Scheduler state as columns. */
function toColumns(card: Card) {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Make sure every node in a chart set has a card.
 *
 * Runs on demand rather than at signup, so adding nodes to a chart set later
 * gives existing users the new cards without a migration. Existing rows are
 * left completely alone — `ignoreDuplicates` means a re-run cannot reset
 * anybody's progress, which is the one thing this function must never do.
 */
export async function ensureNodeCards(
  supabase: SupabaseClient,
  userId: string,
  set: ChartSet,
): Promise<void> {
  const rows = set.nodes.map((node) => ({
    user_id: userId,
    kind: "preflop_node" satisfies CardKind,
    item_key: nodeId(node.key),
    chart_version: set.version,
    payload: {
      chartSetId: set.id,
      scenario: node.key.scenario,
      position: node.key.position,
      villain: node.key.villain ?? null,
    },
    ...toColumns(newCard()),
  }));

  await supabase.from("srs_card").upsert(rows, {
    onConflict: "user_id,kind,item_key",
    ignoreDuplicates: true,
  });
}

export interface DueCard {
  row: CardRow;
  card: Card;
}

/**
 * Cards due now, most overdue first.
 *
 * Ordering by due date happens in the database because that is what the partial
 * index covers. The finer ranking that pulls expensive leaks forward is applied
 * in application code, where the leak costs live.
 */
export async function dueCards(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  now: Date = new Date(),
): Promise<DueCard[]> {
  const { data, error } = await supabase
    .from("srs_card")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .eq("suspended", false)
    .is("retired_at", null)
    .lte("due", now.toISOString())
    .order("due", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Could not load the queue: ${error.message}`);
  const rows = (data ?? []) as unknown as CardRow[];
  return rows.map((row) => ({ row, card: toCard(row) }));
}

/** How many cards are waiting, for the badge on the Today page. */
export async function dueCount(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const { count, error } = await supabase
    .from("srs_card")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("suspended", false)
    .is("retired_at", null)
    .lte("due", now.toISOString());

  if (error) throw new Error(`Could not count the queue: ${error.message}`);
  return count ?? 0;
}

/** One drilled hand, as recorded alongside the review. */
export interface DrilledHand {
  hand: string;
  chosenAction: string;
  expectedAction: string;
  grade: string;
  strategyFreq: number;
  evLossBb?: number;
  rngRoll?: number;
  durationMs: number;
}

/**
 * Record a finished drill: advance the card, and log every hand in it.
 *
 * The log rows carry the *pre-review* scheduler state, because that is what
 * parameter fitting needs — it is trying to predict the review that just
 * happened from what was known before it.
 */
export async function recordReview(
  supabase: SupabaseClient,
  userId: string,
  row: CardRow,
  rating: Grade,
  hands: readonly DrilledHand[],
  now: Date = new Date(),
): Promise<Card> {
  const before = toCard(row);
  const { card: after, log } = review(before, rating, now);

  const { error: updateError } = await supabase
    .from("srs_card")
    .update(toColumns(after))
    .eq("id", row.id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`Could not save the review: ${updateError.message}`);
  }

  // One log row per drilled hand. The scheduler moved once, but the per-hand
  // record is what lets the next drill target the hands actually missed —
  // fine-grained targeting without needing a card per hand.
  const logRows = hands.map((hand) => ({
    card_id: row.id,
    user_id: userId,
    rating,
    state: log.state,
    due: log.due.toISOString(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: now.toISOString(),
    hand: hand.hand,
    chosen_action: hand.chosenAction,
    expected_action: hand.expectedAction,
    action_grade: hand.grade,
    strategy_freq: hand.strategyFreq,
    ev_loss_bb: hand.evLossBb ?? null,
    rng_roll: hand.rngRoll ?? null,
    duration_ms: hand.durationMs,
  }));

  if (logRows.length > 0) {
    const { error: logError } = await supabase.from("srs_review_log").insert(logRows);
    // The card has already moved. Losing the log costs future personalisation,
    // not the review itself, so this is reported rather than thrown — failing
    // here would tell the user their drill did not count when it did.
    if (logError) {
      console.error("Could not write the review log:", logError.message);
    }
  }

  return after;
}

/**
 * Per-hand error counts at a node, used to steer what the next drill shows.
 *
 * Only wrong actions and blunders count. Inaccuracies are by definition the
 * errors that cost almost nothing, and drilling them harder would spend the
 * session on the least valuable thing available.
 */
export async function errorCounts(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("srs_review_log")
    .select("hand, action_grade")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .in("action_grade", ["wrong", "blunder"])
    .order("review", { ascending: false })
    .limit(500);

  if (error) return new Map();

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ hand: string | null }>) {
    if (!row.hand) continue;
    counts.set(row.hand, (counts.get(row.hand) ?? 0) + 1);
  }
  return counts;
}
