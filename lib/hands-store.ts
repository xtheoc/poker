/**
 * Hands, as they live in the database.
 *
 * The layer between the pure parser/grader and Postgres. Everything above this
 * file works on plain objects and can be tested without a database; everything
 * below it is rows.
 *
 * The invariant this module exists to hold: **importing the same hand twice
 * must change nothing.** The folder watcher will re-read the same files
 * constantly, and anyone unsure whether an import worked will drag the folder
 * in again. So the PokerStars hand number is a natural key, and a re-import
 * re-grades in place rather than accumulating duplicate history — which would
 * silently inflate every leak's instance count and promote a single mistake to
 * a confirmed habit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { heroDecisions } from "./hand-history/decisions";
import { parseFile } from "./hand-history/parse";
import { heroResult } from "./hand-history/result";
import type { ParsedHand, UnparsedHand } from "./hand-history/types";
import { type LeakKind, type Violation, violationsInHand } from "./leaks";
import { type ChartSet, findNode, nodeId } from "./poker/charts";
import type { ActionGrade } from "./poker/grading";
import type { Hand } from "./poker/hands";
import type { SessionHand } from "./sessions";
import type { Strategy } from "./strategies";
import {
  reviewHandForStrategy,
  saveStrategyHandReviews,
  type StoredStrategyHand,
} from "./strategies/hand-review";

/** Rows per round trip. Large enough to be fast, small enough to stay clear. */
const BATCH = 200;

/**
 * The tables have not been created yet.
 *
 * Its own error type because it is the one database failure with a specific,
 * actionable fix — run the migration — and because it is guaranteed to happen
 * exactly once to every person who sets this up. A page crashing with a stack
 * trace teaches nothing; a page saying which file to run takes ten seconds to
 * act on.
 */
export class MissingTableError extends Error {
  constructor(readonly table: string) {
    super(`The "${table}" table does not exist yet.`);
    this.name = "MissingTableError";
  }
}

/**
 * Whether a Supabase error means "no such table".
 *
 * PostgREST reports it as PGRST205 with a schema-cache message; Postgres itself
 * uses 42P01. Both are checked, because which one surfaces depends on whether
 * the request got past PostgREST's cached schema.
 */
function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table/i.test(error.message ?? "")
  );
}

/** Turn a Supabase error into either the actionable one or a plain one. */
function fail(
  error: { code?: string; message?: string },
  table: string,
  context: string,
): never {
  if (missingTable(error)) throw new MissingTableError(table);
  throw new Error(`${context}: ${error.message}`);
}

export interface ImportSummary {
  /** Hands the parser understood. */
  parsed: number;
  /** Hands written, whether newly inserted or re-graded in place. */
  stored: number;
  /** Hands that had already been imported before this run. */
  duplicates: number;
  /** Hands the parser could not read, kept for a later parser fix. */
  unparsed: UnparsedHand[];
  /** Charted preflop decisions found across the import. */
  charted: number;
  mistakes: number;
  /** The newest hand in this import, so the caller can link to its sitting. */
  latestHandId: string | null;
  /** Hands also reviewed under one of the supplied strategies. */
  strategyReviewed: number;
}

export interface ImportOptions {
  /**
   * Strategies whose filters should automatically claim and review matching
   * hands. Omitted by the legacy generic re-grader, which only touches its
   * existing workspace verdicts.
   */
  strategies?: readonly Strategy[];
}

interface HandRow {
  id: string;
  ps_hand_id: string;
  played_at: string;
  net_bb: number | null;
  vpip: boolean;
  pfr: boolean;
  saw_flop: boolean;
  went_to_showdown: boolean;
  won_at_showdown: boolean;
  won: boolean;
  charted_decisions: number;
  position: string | null;
}

/**
 * Parse, grade and store a hand-history file.
 *
 * Grading happens here rather than in the browser so the chart set doing the
 * grading is the one the server is running, and so a future re-grade can replay
 * stored raw text through exactly this path.
 */
export async function importHands(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  set: ChartSet,
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { hands, errors } = parseFile(text);
  const tree = { treeId: set.treeId, chartStackBb: set.stackBb };

  const rows: Record<string, unknown>[] = [];
  const violationsByHandId = new Map<string, Violation[]>();
  let charted = 0;
  let mistakes = 0;

  for (const hand of hands) {
    const decisions = heroDecisions(hand, tree);
    // Only decisions this chart set actually holds a range for. `heroDecisions`
    // names a node for every spot the *tree* recognises, which is a wider set
    // than any chart covers — and counting those would put ungraded decisions
    // in the denominator of your accuracy, where they would silently score as
    // correct. Version 3 dropped fifteen nodes, so that gap is now most of a
    // session rather than a rounding error.
    const chartedHere = decisions.filter(
      (d) => d.node && findNode(set, nodeId(d.node)),
    ).length;
    const violations = violationsInHand(hand, decisions, set);

    charted += chartedHere;
    mistakes += violations.length;
    if (violations.length > 0) violationsByHandId.set(hand.id, violations);

    rows.push(handRow(userId, hand, chartedHere, set));
  }

  if (rows.length === 0) {
    return {
      parsed: 0,
      stored: 0,
      duplicates: 0,
      unparsed: errors,
      charted: 0,
      mistakes: 0,
      latestHandId: null,
      strategyReviewed: 0,
    };
  }

  // Which hands were already here, so the summary can say "nothing new" rather
  // than reporting a triumphant import of hands imported last week.
  const existing = await existingHandIds(
    supabase,
    userId,
    rows.map((r) => r.ps_hand_id as string),
  );

  const stored: HandRow[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await supabase
      .from("played_hand")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "user_id,ps_hand_id" })
      .select("id, ps_hand_id");

    if (error) fail(error, "played_hand", "Could not save those hands");
    stored.push(...((data ?? []) as unknown as HandRow[]));
  }

  await replaceViolations(supabase, userId, stored, violationsByHandId, set);

  const storedByPokerStarsId = new Map(
    stored.map((row) => [row.ps_hand_id, { id: row.id, psHandId: row.ps_hand_id }]),
  );
  const strategyReviews = hands.flatMap((hand) => {
    const strategyHand = storedByPokerStarsId.get(hand.id);
    if (!strategyHand) return [];

    return (options.strategies ?? [])
      .map((strategy) =>
        reviewHandForStrategy(
          hand,
          strategyHand as StoredStrategyHand,
          strategy,
        ),
      )
      .filter((review): review is NonNullable<typeof review> => review !== null);
  });
  await saveStrategyHandReviews(supabase, userId, strategyReviews);

  const newest = hands.reduce<ParsedHand | null>(
    (latest, hand) => (!latest || hand.playedAt > latest.playedAt ? hand : latest),
    null,
  );

  return {
    parsed: hands.length,
    stored: stored.length,
    duplicates: existing.size,
    unparsed: errors,
    charted,
    mistakes,
    latestHandId: newest?.id ?? null,
    strategyReviewed: strategyReviews.length,
  };
}

function handRow(
  userId: string,
  hand: ParsedHand,
  chartedDecisions: number,
  set: ChartSet,
): Record<string, unknown> {
  const result = heroResult(hand);

  return {
    user_id: userId,
    ps_hand_id: hand.id,
    played_at: hand.playedAt.toISOString(),
    table_name: hand.tableName,
    game_type: hand.gameType,
    fast_fold: hand.fastFold,
    max_seats: hand.maxSeats,
    big_blind: hand.bigBlind,
    currency: hand.currency,
    hero_alias: hand.hero?.player ?? null,
    hero_cards: hand.hero?.cards ?? null,
    hand_class: result?.handClass ?? null,
    position: result?.position ?? null,
    net_bb: result?.netBb ?? null,
    vpip: result?.vpip ?? false,
    pfr: result?.pfr ?? false,
    saw_flop: result?.sawFlop ?? false,
    went_to_showdown: result?.wentToShowdown ?? false,
    won_at_showdown: result?.wonAtShowdown ?? false,
    won: result?.won ?? false,
    charted_decisions: chartedDecisions,
    chart_version: set.version,
    raw: hand.raw,
    // `imported_at` is deliberately absent. It has a default, so an insert sets
    // it and a re-grade leaves the original import time alone.
  };
}

async function existingHandIds(
  supabase: SupabaseClient,
  userId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  const found = new Set<string>();

  for (let i = 0; i < ids.length; i += BATCH) {
    const { data } = await supabase
      .from("played_hand")
      .select("ps_hand_id")
      .eq("user_id", userId)
      .in("ps_hand_id", ids.slice(i, i + BATCH));

    for (const row of (data ?? []) as Array<{ ps_hand_id: string }>) {
      found.add(row.ps_hand_id);
    }
  }

  return found;
}

/**
 * Replace the violations for the hands just imported.
 *
 * Deleted and rewritten rather than inserted-if-absent, because a re-import may
 * be a deliberate re-grade under a newer chart set — and a mistake the new
 * chart forgives has to actually disappear, rather than lingering as evidence
 * for a leak that no longer exists.
 */
async function replaceViolations(
  supabase: SupabaseClient,
  userId: string,
  stored: readonly HandRow[],
  byHandId: ReadonlyMap<string, Violation[]>,
  set: ChartSet,
): Promise<void> {
  const ids = stored.map((row) => row.id);

  for (let i = 0; i < ids.length; i += BATCH) {
    const { error } = await supabase
      .from("hand_violation")
      .delete()
      .eq("user_id", userId)
      .in("hand_id", ids.slice(i, i + BATCH));

    if (error) fail(error, "hand_violation", "Could not clear old mistakes");
  }

  const rows = stored.flatMap((row) =>
    (byHandId.get(row.ps_hand_id) ?? []).map((violation) => ({
      user_id: userId,
      hand_id: row.id,
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
      chart_version: set.version,
    })),
  );

  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from("hand_violation")
      .insert(rows.slice(i, i + BATCH));

    if (error) fail(error, "hand_violation", "Could not save those mistakes");
  }
}

/**
 * Every stored hand, as the session grouper wants them.
 *
 * Capped rather than paginated. A year at this volume is roughly fifty thousand
 * hands, the cap sits well above that, and a limit that truncates the oldest
 * history is better than a page that times out.
 */
export async function loadSessionHands(
  supabase: SupabaseClient,
  userId: string,
  limit = 20_000,
): Promise<SessionHand[]> {
  const { data, error } = await supabase
    .from("played_hand")
    .select(
      "ps_hand_id, played_at, net_bb, vpip, pfr, saw_flop, went_to_showdown, " +
        "won_at_showdown, won, charted_decisions, position",
    )
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error) fail(error, "played_hand", "Could not load your hands");

  const rows = (data ?? []) as unknown as HandRow[];
  const mistakes = await mistakeCounts(supabase, userId);

  return rows.map((row) => ({
    psHandId: row.ps_hand_id,
    playedAt: new Date(row.played_at),
    netBb: row.net_bb ?? 0,
    vpip: row.vpip,
    pfr: row.pfr,
    sawFlop: row.saw_flop,
    wentToShowdown: row.went_to_showdown,
    wonAtShowdown: row.won_at_showdown,
    won: row.won,
    chartedDecisions: row.charted_decisions,
    mistakes: mistakes.get(row.ps_hand_id) ?? 0,
    position: row.position,
  }));
}

async function mistakeCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("hand_violation")
    .select("ps_hand_id")
    .eq("user_id", userId);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ ps_hand_id: string }>) {
    counts.set(row.ps_hand_id, (counts.get(row.ps_hand_id) ?? 0) + 1);
  }
  return counts;
}

interface ViolationRow {
  ps_hand_id: string;
  played_at: string;
  node_id: string;
  spot: string;
  hand_class: string;
  chosen: string;
  expected: string;
  action_grade: string;
  kind: string;
  ev_loss_bb: number | null;
}

/** Every stored mistake, ready for the leak engine. */
export async function loadViolations(
  supabase: SupabaseClient,
  userId: string,
): Promise<Violation[]> {
  const { data, error } = await supabase
    .from("hand_violation")
    .select(
      "ps_hand_id, played_at, node_id, spot, hand_class, chosen, expected, " +
        "action_grade, kind, ev_loss_bb",
    )
    .eq("user_id", userId)
    .order("played_at", { ascending: false });

  if (error) fail(error, "hand_violation", "Could not load your mistakes");

  return ((data ?? []) as unknown as ViolationRow[]).map((row) => ({
    handId: row.ps_hand_id,
    playedAt: new Date(row.played_at),
    hand: row.hand_class as Hand,
    nodeId: row.node_id,
    spot: row.spot,
    chosen: row.chosen as Violation["chosen"],
    expected: row.expected as Violation["expected"],
    grade: row.action_grade as ActionGrade,
    kind: row.kind as LeakKind,
    evLossBb: row.ev_loss_bb ?? undefined,
  }));
}

/**
 * Remove hands, and the mistakes found in them.
 *
 * Genuinely destructive and genuinely necessary. A bad import — the wrong file,
 * somebody else's history, or the synthetic fixture used to prove the pipeline
 * worked — is otherwise permanent, and it does not sit there inertly: it counts
 * toward your accuracy, and its mistakes become leaks you are then told to
 * drill. Data you cannot remove is data you cannot trust.
 *
 * `hand_violation` carries `on delete cascade`, so violations go with the hands
 * rather than being left orphaned.
 */
export async function deleteHands(
  supabase: SupabaseClient,
  userId: string,
  psHandIds: readonly string[],
): Promise<number> {
  if (psHandIds.length === 0) return 0;

  let removed = 0;
  for (let i = 0; i < psHandIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from("played_hand")
      .delete()
      .eq("user_id", userId)
      .in("ps_hand_id", psHandIds.slice(i, i + BATCH))
      .select("ps_hand_id");

    if (error) fail(error, "played_hand", "Could not remove those hands");
    removed += (data ?? []).length;
  }

  return removed;
}

/** One hand as a search result. */
export interface HandMatch {
  psHandId: string;
  playedAt: Date;
  /** One of the 169 classes, e.g. "AKo". Null for a hand you were not dealt. */
  handClass: string | null;
  position: string | null;
  cards: string[];
  netBb: number;
}

export interface HandQuery {
  /** A hand class, matched exactly and case-insensitively. */
  handClass?: string;
  /** A position, e.g. "BTN". */
  position?: string;
  limit?: number;
}

/**
 * Find hands, by what you held and where you sat.
 *
 * Every route into stored hands previously went through a mistake, which means
 * the hands you played *correctly* were unreachable — and those are exactly the
 * ones worth checking when you want to know whether a fold you keep making is
 * really the one the chart wants, or when a hand class starts feeling like a
 * problem before it has generated three violations.
 *
 * Both filters are optional and combine, so an empty query is simply "my recent
 * hands". `hand_class` and `position` are stored denormalised on the row, so
 * this needs no join and no scan of the raw text.
 */
export async function searchHands(
  supabase: SupabaseClient,
  userId: string,
  query: HandQuery = {},
): Promise<HandMatch[]> {
  let request = supabase
    .from("played_hand")
    .select("ps_hand_id, played_at, hand_class, position, hero_cards, net_bb")
    .eq("user_id", userId);

  // `ilike` without wildcards is an exact, case-insensitive match — "ako" and
  // "AKo" are the same hand, and nobody types the trailing o in the right case.
  if (query.handClass) request = request.ilike("hand_class", query.handClass);
  if (query.position) request = request.ilike("position", query.position);

  const { data, error } = await request
    .order("played_at", { ascending: false })
    .limit(query.limit ?? 100);

  if (error) fail(error, "played_hand", "Could not search your hands");

  const rows = (data ?? []) as unknown as Array<{
    ps_hand_id: string;
    played_at: string;
    hand_class: string | null;
    position: string | null;
    hero_cards: string[] | null;
    net_bb: number | null;
  }>;

  return rows.map((row) => ({
    psHandId: row.ps_hand_id,
    playedAt: new Date(row.played_at),
    handClass: row.hand_class,
    position: row.position,
    cards: row.hero_cards ?? [],
    netBb: row.net_bb ?? 0,
  }));
}

/** Hands fetched per page when replaying the whole history. */
const PAGE = 500;

export interface RegradeSummary {
  hands: number;
  charted: number;
  mistakes: number;
}

/**
 * Re-grade every stored hand against the current chart set.
 *
 * This is why the raw text is stored alongside the parsed columns, and it runs
 * through `importHands` rather than through a second grading path of its own.
 * A separate re-grader would be a second opinion about what a mistake is, and
 * the two would drift — the first time they disagreed, the hand you replayed
 * would be graded differently from the hand you imported.
 *
 * Because the import upserts on `(user_id, ps_hand_id)` and replaces the
 * violations for every hand it touches, replaying is idempotent: mistakes the
 * new chart no longer recognises are deleted rather than left orphaned, and
 * `imported_at` keeps its original value because the column has a default and
 * the row never sets it.
 *
 * Paged, because a year of play is tens of thousands of rows and the raw text
 * is the largest column in the table.
 */
export async function regradeHands(
  supabase: SupabaseClient,
  userId: string,
  set: ChartSet,
  options: ImportOptions = {},
): Promise<RegradeSummary> {
  const summary: RegradeSummary = { hands: 0, charted: 0, mistakes: 0 };

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("played_hand")
      .select("raw")
      .eq("user_id", userId)
      .order("played_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) fail(error, "played_hand", "Could not read your hands back");

    const page = (data ?? []) as Array<{ raw: string }>;
    if (page.length === 0) break;

    // Hand histories are separated by blank lines, which is exactly how the
    // parser splits a file, so rejoining stored hands reconstitutes one.
    const result = await importHands(
      supabase,
      userId,
      page.map((row) => row.raw.trim()).join("\n\n"),
      set,
      options,
    );

    summary.hands += result.stored;
    summary.charted += result.charted;
    summary.mistakes += result.mistakes;

    if (page.length < PAGE) break;
  }

  return summary;
}

/** One stored hand's original text, for replaying it. */
export async function loadRawHand(
  supabase: SupabaseClient,
  userId: string,
  psHandId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("played_hand")
    .select("raw")
    .eq("user_id", userId)
    .eq("ps_hand_id", psHandId)
    .maybeSingle();

  return (data as { raw: string } | null)?.raw ?? null;
}
