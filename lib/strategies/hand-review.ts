/** Strategy-specific assignment, review persistence, and dashboard totals. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { heroDecisions } from "../hand-history/decisions";
import { parseFile } from "../hand-history/parse";
import { heroResult } from "../hand-history/result";
import type { ParsedHand } from "../hand-history/types";
import { type Violation } from "../leaks";
import { reviewPreflopCoverage, type StrategyPreflopDecision } from "./preflop-coverage";
import type { Strategy } from "./index";
import { matchesHandFilter } from "./hand-filter";
import type { SessionHand } from "../sessions";

const BATCH = 200;
const REBUILD_PAGE = 250;

export class MissingStrategyReviewTablesError extends Error {
  constructor() {
    super("The strategy hand-review tables do not exist yet.");
    this.name = "MissingStrategyReviewTablesError";
  }
}

export class MissingStrategyDecisionTablesError extends Error {
  constructor() {
    super("The strategy decision-coverage table does not exist yet.");
    this.name = "MissingStrategyDecisionTablesError";
  }
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === "PGRST205" ||
        error.code === "42P01" ||
        /Could not find the table/i.test(error.message ?? "")),
  );
}

function fail(error: { code?: string; message?: string }, context: string): never {
  if (missingTable(error)) throw new MissingStrategyReviewTablesError();
  throw new Error(`${context}: ${error.message}`);
}

function failDecision(error: { code?: string; message?: string }, context: string): never {
  if (missingTable(error)) throw new MissingStrategyDecisionTablesError();
  throw new Error(`${context}: ${error.message}`);
}

export interface StoredStrategyHand {
  id: string;
  psHandId: string;
}

export interface StrategyHandReview {
  strategy: Strategy;
  hand: ParsedHand;
  stored: StoredStrategyHand;
  charted: number;
  violations: readonly Violation[];
  decisions: readonly StrategyPreflopDecision[];
}

/**
 * Evaluate a parsed hand under one strategy.
 *
 * A strategy only claims hands whose declared tracking filter matches. This is
 * deliberately separate from the generic review: the same hand can be clean
 * under one strategy and a mistake under another without either review lying.
 */
export function reviewHandForStrategy(
  hand: ParsedHand,
  stored: StoredStrategyHand,
  strategy: Strategy,
): StrategyHandReview | null {
  if (!strategy.learning) return null;
  if (
    !matchesHandFilter(
      {
        bigBlind: hand.bigBlind,
        currency: hand.currency,
        gameType: hand.gameType,
        maxSeats: hand.maxSeats,
        fastFold: hand.fastFold,
        playedAt: hand.playedAt,
      },
      strategy.learning.tracking.filter,
    )
  ) {
    return null;
  }

  const parsedDecisions = heroDecisions(hand, {
    treeId: strategy.chartSet.treeId,
    chartStackBb: strategy.chartSet.stackBb,
  });
  const decisions = reviewPreflopCoverage(hand, parsedDecisions, strategy.chartSet);
  const violations = decisions.flatMap((decision) => decision.violation ? [decision.violation] : []);

  return {
    strategy,
    hand,
    stored,
    charted: decisions.filter((decision) => decision.status === "gradeable").length,
    violations,
    decisions,
  };
}

/** Map a charted preflop scenario to the lesson that taught it. */
export function lessonForNode(node: string): string | null {
  if (node.includes("/rfi/")) return "open-with-purpose";
  if (node.includes("/vs-limp/")) return "open-with-purpose";
  if (node.includes("/vs-rfi/")) return "face-an-open";
  if (node.includes("/vs-3bet/")) return "three-bet-tree";
  if (node.includes("/vs-4bet/")) return "four-bet-tree";
  return null;
}

/** Persist automatic assignments and replace strategy verdicts for these hands. */
export async function saveStrategyHandReviews(
  supabase: SupabaseClient,
  userId: string,
  reviews: readonly StrategyHandReview[],
): Promise<void> {
  if (reviews.length === 0) return;

  const assignments = reviews.map((review) => ({
    user_id: userId,
    hand_id: review.stored.id,
    strategy_id: review.strategy.id,
    filter_version: review.strategy.learning!.tracking.filterVersion,
    source: "automatic",
  }));

  for (let from = 0; from < assignments.length; from += BATCH) {
    const { error } = await supabase.from("strategy_hand_assignment").upsert(
      assignments.slice(from, from + BATCH),
      { onConflict: "user_id,hand_id,strategy_id" },
    );
    if (error) fail(error, "Could not assign those hands to their strategy");
  }

  const reviewRows = reviews.map((review) => {
    const result = heroResult(review.hand);
    return {
      user_id: userId,
      hand_id: review.stored.id,
      strategy_id: review.strategy.id,
      filter_version: review.strategy.learning!.tracking.filterVersion,
      chart_version: review.strategy.chartSet.version,
      charted_decisions: review.charted,
      mistake_count: review.violations.length,
      net_bb: result?.netBb ?? null,
      vpip: result?.vpip ?? false,
      pfr: result?.pfr ?? false,
      reviewed_at: new Date().toISOString(),
    };
  });

  const persisted: Array<{ id: string; hand_id: string; strategy_id: string }> = [];
  for (let from = 0; from < reviewRows.length; from += BATCH) {
    const { data, error } = await supabase
      .from("strategy_hand_review")
      .upsert(reviewRows.slice(from, from + BATCH), {
        onConflict: "user_id,hand_id,strategy_id",
      })
      .select("id, hand_id, strategy_id");
    if (error) fail(error, "Could not save those strategy reviews");
    persisted.push(...((data ?? []) as Array<{ id: string; hand_id: string; strategy_id: string }>));
  }

  const reviewIdByHandAndStrategy = new Map(
    persisted.map((row) => [`${row.hand_id}/${row.strategy_id}`, row.id]),
  );
  const reviewIds = persisted.map((row) => row.id);
  for (let from = 0; from < reviewIds.length; from += BATCH) {
    const { error } = await supabase
      .from("strategy_hand_violation")
      .delete()
      .eq("user_id", userId)
      .in("review_id", reviewIds.slice(from, from + BATCH));
    if (error) fail(error, "Could not clear old strategy mistakes");
  }

  for (let from = 0; from < reviewIds.length; from += BATCH) {
    const { error } = await supabase
      .from("strategy_hand_decision")
      .delete()
      .eq("user_id", userId)
      .in("review_id", reviewIds.slice(from, from + BATCH));
    if (error) failDecision(error, "Could not clear old strategy decision coverage");
  }

  const violations = reviews.flatMap((review) => {
    const reviewId = reviewIdByHandAndStrategy.get(
      `${review.stored.id}/${review.strategy.id}`,
    );
    if (!reviewId) return [];

    return review.violations.map((violation) => ({
      user_id: userId,
      review_id: reviewId,
      hand_id: review.stored.id,
      strategy_id: review.strategy.id,
      lesson_id: lessonForNode(violation.nodeId),
      ps_hand_id: violation.handId,
      played_at: violation.playedAt.toISOString(),
      node_id: violation.nodeId,
      spot: violation.spot,
      hand_class: violation.hand,
      chosen: violation.chosen,
      expected: violation.expected,
      action_grade: violation.grade,
      kind: violation.kind,
      ev_loss_bb: violation.evLossBb ?? null,
      chart_version: review.strategy.chartSet.version,
    }));
  });

  for (let from = 0; from < violations.length; from += BATCH) {
    const { error } = await supabase
      .from("strategy_hand_violation")
      .insert(violations.slice(from, from + BATCH));
    if (error) fail(error, "Could not save those strategy mistakes");
  }

  const decisions = reviews.flatMap((review) => {
    const reviewId = reviewIdByHandAndStrategy.get(
      `${review.stored.id}/${review.strategy.id}`,
    );
    if (!reviewId) return [];
    return review.decisions.map((decision) => ({
      user_id: userId,
      review_id: reviewId,
      hand_id: review.stored.id,
      strategy_id: review.strategy.id,
      ps_hand_id: review.hand.id,
      played_at: review.hand.playedAt.toISOString(),
      decision_index: decision.index,
      family: decision.family,
      coverage_status: decision.status,
      skip_reason: decision.reason ?? null,
      node_id: decision.nodeId ?? null,
      hand_class: decision.hand,
      actual: decision.actual,
      expected: decision.expected ?? null,
      action_grade: decision.grade ?? null,
      effective_stack_bb: decision.effectiveStackBb ?? null,
      chart_version: review.strategy.chartSet.version,
    }));
  });
  for (let from = 0; from < decisions.length; from += BATCH) {
    const { error } = await supabase
      .from("strategy_hand_decision")
      .insert(decisions.slice(from, from + BATCH));
    if (error) failDecision(error, "Could not save strategy decision coverage");
  }

}

export interface StrategyRebuildSummary {
  hands: number;
  charted: number;
  mistakes: number;
}

/**
 * Review hands that were already imported before strategy tracking existed.
 *
 * The original hand text is the authoritative source, so this deliberately
 * re-parses it instead of trying to reconstruct decisions from summary columns.
 */
export async function rebuildStrategyHandReviews(
  supabase: SupabaseClient,
  userId: string,
  strategy: Strategy,
): Promise<StrategyRebuildSummary> {
  const summary: StrategyRebuildSummary = { hands: 0, charted: 0, mistakes: 0 };

  for (let from = 0; ; from += REBUILD_PAGE) {
    const { data, error } = await supabase
      .from("played_hand")
      .select("id, ps_hand_id, raw")
      .eq("user_id", userId)
      .order("played_at", { ascending: true })
      .range(from, from + REBUILD_PAGE - 1);
    if (error) fail(error, "Could not read your existing hands");

    const rows = (data ?? []) as Array<{ id: string; ps_hand_id: string; raw: string }>;
    if (rows.length === 0) break;

    const storedByPokerStarsId = new Map(
      rows.map((row) => [row.ps_hand_id, { id: row.id, psHandId: row.ps_hand_id }]),
    );
    const parsed = parseFile(rows.map((row) => row.raw.trim()).join("\n\n")).hands;
    const reviews = parsed.flatMap((hand) => {
      const stored = storedByPokerStarsId.get(hand.id);
      if (!stored) return [];
      const review = reviewHandForStrategy(hand, stored, strategy);
      return review ? [review] : [];
    });
    await saveStrategyHandReviews(supabase, userId, reviews);

    summary.hands += reviews.length;
    summary.charted += reviews.reduce((total, review) => total + review.charted, 0);
    summary.mistakes += reviews.reduce(
      (total, review) => total + review.violations.length,
      0,
    );

    if (rows.length < REBUILD_PAGE) break;
  }

  return summary;
}

export interface StrategyReviewSummary {
  hands: number;
  netBb: number;
  vpip: number | null;
  pfr: number | null;
  charted: number;
  mistakes: number;
  accuracy: number | null;
}

/** A stored hand as the strategy's session review needs to display it. */
export interface StrategySessionHand extends SessionHand {
  handClass: string | null;
  cards: string[];
}

interface StrategySessionReviewRow {
  hand_id: string;
  charted_decisions: number;
  mistake_count: number;
  net_bb: number | null;
  vpip: boolean;
  pfr: boolean;
}

interface StrategySessionHandRow {
  id: string;
  ps_hand_id: string;
  played_at: string;
  position: string | null;
  hand_class: string | null;
  hero_cards: unknown;
  saw_flop: boolean;
  went_to_showdown: boolean;
  won_at_showdown: boolean;
  won: boolean;
}

/**
 * The strategy's hands, ready to group into sittings.
 *
 * `strategy_hand_review` deliberately owns the verdict while `played_hand`
 * owns the immutable hand facts. Keeping the two queries explicit makes that
 * boundary visible and avoids a database-specific embedded join in a page.
 */
export async function loadStrategySessionHands(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<StrategySessionHand[]> {
  const { data, error } = await supabase
    .from("strategy_hand_review")
    .select("hand_id, charted_decisions, mistake_count, net_bb, vpip, pfr")
    .eq("user_id", userId)
    .eq("strategy_id", strategyId);
  if (error) fail(error, "Could not load strategy sessions");

  const reviews = (data ?? []) as StrategySessionReviewRow[];
  const factsById = new Map<string, StrategySessionHandRow>();
  for (let from = 0; from < reviews.length; from += BATCH) {
    const ids = reviews.slice(from, from + BATCH).map((review) => review.hand_id);
    if (ids.length === 0) continue;
    const { data: facts, error: factsError } = await supabase
      .from("played_hand")
      .select(
        "id, ps_hand_id, played_at, position, hand_class, hero_cards, saw_flop, " +
          "went_to_showdown, won_at_showdown, won",
      )
      .eq("user_id", userId)
      .in("id", ids);
    if (factsError) fail(factsError, "Could not load session hands");
    for (const fact of (facts ?? []) as unknown as StrategySessionHandRow[]) {
      factsById.set(fact.id, fact);
    }
  }

  return reviews.flatMap((review) => {
    const hand = factsById.get(review.hand_id);
    if (!hand) return [];
    return [{
      psHandId: hand.ps_hand_id,
      playedAt: new Date(hand.played_at),
      netBb: review.net_bb ?? 0,
      vpip: review.vpip,
      pfr: review.pfr,
      sawFlop: hand.saw_flop,
      wentToShowdown: hand.went_to_showdown,
      wonAtShowdown: hand.won_at_showdown,
      won: hand.won,
      chartedDecisions: review.charted_decisions,
      mistakes: review.mistake_count,
      position: hand.position,
      handClass: hand.hand_class,
      // Older imports and PostgREST responses are external data at this point.
      // A malformed card field must not make an otherwise valid session page
      // fail to render; the hand class remains a useful fallback label.
      cards: Array.isArray(hand.hero_cards)
        ? hand.hero_cards.filter((card): card is string => typeof card === "string")
        : [],
    }];
  });
}

export interface StrategyCoverage {
  total: number;
  gradeable: number;
  correct: number;
  mistakes: number;
  drillOnly: number;
  unsupported: number;
}

interface StrategyDecisionRow {
  coverage_status: "gradeable" | "drill-only" | "not-supported";
  action_grade: string | null;
}

/** Counts every observed preflop decision, including the ones not judged yet. */
export async function loadStrategyCoverage(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<StrategyCoverage> {
  const { data, error } = await supabase
    .from("strategy_hand_decision")
    .select("coverage_status, action_grade")
    .eq("user_id", userId)
    .eq("strategy_id", strategyId);
  if (error) failDecision(error, "Could not load strategy decision coverage");

  const rows = (data ?? []) as StrategyDecisionRow[];
  const gradeable = rows.filter((row) => row.coverage_status === "gradeable");
  const mistakes = gradeable.filter(
    (row) => row.action_grade !== "best" && row.action_grade !== "correct",
  ).length;
  return {
    total: rows.length,
    gradeable: gradeable.length,
    correct: gradeable.length - mistakes,
    mistakes,
    drillOnly: rows.filter((row) => row.coverage_status === "drill-only").length,
    unsupported: rows.filter((row) => row.coverage_status === "not-supported").length,
  };
}

interface StrategyReviewRow {
  charted_decisions: number;
  mistake_count: number;
  net_bb: number | null;
  vpip: boolean;
  pfr: boolean;
}

export async function loadStrategyReviewSummary(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<StrategyReviewSummary> {
  const { data, error } = await supabase
    .from("strategy_hand_review")
    .select("charted_decisions, mistake_count, net_bb, vpip, pfr")
    .eq("user_id", userId)
    .eq("strategy_id", strategyId);
  if (error) fail(error, "Could not load strategy hand reviews");

  const rows = (data ?? []) as StrategyReviewRow[];
  const hands = rows.length;
  const charted = rows.reduce((total, row) => total + row.charted_decisions, 0);
  const mistakes = rows.reduce((total, row) => total + row.mistake_count, 0);

  return {
    hands,
    netBb: rows.reduce((total, row) => total + (row.net_bb ?? 0), 0),
    vpip: hands === 0 ? null : (rows.filter((row) => row.vpip).length / hands) * 100,
    pfr: hands === 0 ? null : (rows.filter((row) => row.pfr).length / hands) * 100,
    charted,
    mistakes,
    accuracy: charted === 0 ? null : ((charted - mistakes) / charted) * 100,
  };
}

interface StoredViolation {
  ps_hand_id: string;
  played_at: string;
  hand_class: string;
  node_id: string;
  spot: string;
  chosen: string;
  expected: string;
  action_grade: string;
  kind: string;
  ev_loss_bb: number | null;
}

export async function loadStrategyViolations(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<Violation[]> {
  const { data, error } = await supabase
    .from("strategy_hand_violation")
    .select(
      "ps_hand_id, played_at, hand_class, node_id, spot, chosen, expected, " +
        "action_grade, kind, ev_loss_bb",
    )
    .eq("user_id", userId)
    .eq("strategy_id", strategyId)
    .order("played_at", { ascending: false });
  if (error) fail(error, "Could not load strategy mistakes");

  return ((data ?? []) as unknown as StoredViolation[]).map((row) => ({
    handId: row.ps_hand_id,
    playedAt: new Date(row.played_at),
    hand: row.hand_class as Violation["hand"],
    nodeId: row.node_id,
    spot: row.spot,
    chosen: row.chosen as Violation["chosen"],
    expected: row.expected as Violation["expected"],
    grade: row.action_grade as Violation["grade"],
    kind: row.kind as Violation["kind"],
    evLossBb: row.ev_loss_bb ?? undefined,
  }));
}
