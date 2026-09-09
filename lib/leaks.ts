/**
 * Finding leaks, and — harder — ranking them honestly.
 *
 * Two things make this different from the obvious implementation.
 *
 * **It classifies decisions rather than estimating frequencies.** The usual
 * approach measures a statistic and compares it to a baseline, which needs
 * thousands of hands before it means anything. Here each preflop decision is
 * checked against the chart individually, so a violation is a verifiable fact
 * about one hand rather than an inference from a sample. That is what makes
 * this useful at a few hundred hands a week instead of a few thousand.
 *
 * **It ranks by frequency, not by drama.** The mistake every naive leak-finder
 * makes is sorting by the size of the pot lost, which surfaces the one
 * spectacular disaster and buries the small error made two hundred times. The
 * small repeated error is almost always the expensive one.
 *
 * And it refuses to call something a leak on thin evidence. One mistake is a
 * mistake; a leak is a pattern, and the difference is whether it recurs across
 * sessions.
 */

import type { HeroDecision } from "./hand-history/decisions";
import type { ParsedHand } from "./hand-history/types";
import { chartProvider } from "./poker/chart-provider";
import { type ActionKind, type ChartSet, nodeId } from "./poker/charts";
import { type ActionGrade, gradeAction } from "./poker/grading";
import type { Hand } from "./poker/hands";

/** One decision the chart disagreed with. */
export interface Violation {
  handId: string;
  playedAt: Date;
  hand: Hand;
  nodeId: string;
  /** Human-readable spot, e.g. "CO open" or "BB vs BTN". */
  spot: string;
  chosen: ActionKind;
  expected: ActionKind;
  grade: ActionGrade;
  kind: LeakKind;
  /** Only present once a source that knows EV is installed. */
  evLossBb?: number;
}

/**
 * The three shapes a preflop error takes.
 *
 * Grouping by shape rather than by hand is what turns a list of mistakes into
 * something actionable. "You call too wide in the small blind" is a lesson;
 * "you misplayed K9o, and J8s, and A4o" is a list.
 */
export type LeakKind = "too-loose" | "too-tight" | "wrong-line";

const KIND_LABELS: Record<LeakKind, string> = {
  "too-loose": "Playing hands that should fold",
  "too-tight": "Folding hands that should play",
  "wrong-line": "Right hand, wrong action",
};

/**
 * Relative weights used to order leaks.
 *
 * **These are ordering weights, not big blinds.** Without a source that knows
 * EV there is no honest way to say what a preflop error cost, and inventing a
 * number would be exactly the false precision this platform exists to avoid.
 * What can be said with confidence is the *ordering*: at micro stakes playing
 * too many hands is the dominant leak, folding too much is real but cheaper,
 * and taking the wrong line with a hand that belongs in the pot is cheaper
 * still. Real EV replaces these the moment it exists.
 */
const KIND_WEIGHTS: Record<LeakKind, number> = {
  "too-loose": 1,
  "wrong-line": 0.6,
  "too-tight": 0.4,
};

/**
 * How established a pattern this is.
 *
 * A label, not a gate. It used to withhold drills below `likely`, on the
 * grounds that acting on thin evidence trains you against randomness — and that
 * reasoning is correct about *frequency statistics* and wrong here. A stat like
 * fold-to-3bet is an estimate, and a small sample of it really can be noise. A
 * chart violation is not an estimate: opening K3o in the cutoff was outside the
 * range, once, as a matter of fact. There is nothing to be uncertain about.
 *
 * So confidence still says how habitual something looks, and every violation is
 * drillable. Withholding practice on a spot you verifiably misplayed was a
 * misapplication of the sample-size rule.
 */
export type LeakConfidence = "watching" | "likely" | "confirmed";

export interface Leak {
  id: string;
  nodeId: string;
  spot: string;
  kind: LeakKind;
  label: string;
  instances: number;
  /** How many separate sessions this showed up in. */
  sessions: number;
  /** The hands that prove it, newest first. Evidence, not a summary. */
  handIds: string[];
  /** The specific hand classes misplayed, for targeting the drill. */
  hands: Hand[];
  /**
   * When this last happened.
   *
   * The drill cycles most-recent-first, which is a different ordering from the
   * cost ranking below and defensible on its own terms: a mistake made an hour
   * ago is still attached to a memory of playing the hand, and that is when
   * correcting it lands hardest. Cost decides what deserves attention over
   * months; recency decides what to look at tonight.
   */
  lastSeenAt: Date;
  confidence: LeakConfidence;
  drillable: boolean;
  /** Total EV given up, when a source that knows EV supplied it. */
  totalCostBb?: number;
  /** Ranking score. Comparable between leaks; not a currency. */
  score: number;
}

/** Minimum instances before a pattern is worth naming at all. */
export const MIN_INSTANCES = 3;
/** Minimum separate sessions before a pattern counts as established. */
export const MIN_SESSIONS = 2;
/** Instances and sessions at which a leak stops being provisional. */
export const CONFIRMED_INSTANCES = 8;
export const CONFIRMED_SESSIONS = 3;

/**
 * A gap longer than this starts a new session.
 *
 * Sessions matter because a leak appearing ten times in one sitting may be tilt
 * or an unusual table, while the same error across three sittings is a habit.
 * An hour is long enough to survive a break and short enough to separate an
 * afternoon from an evening.
 */
export const SESSION_GAP_MINUTES = 60;

/**
 * Check every charted preflop decision in a hand against the chart.
 *
 * Decisions the chart does not cover are skipped silently — that is the
 * majority of them, and it is correct.
 */
export function violationsInHand(
  parsed: ParsedHand,
  decisions: readonly HeroDecision[],
  set: ChartSet,
): Violation[] {
  const provider = chartProvider(set);
  const found: Violation[] = [];

  for (const decision of decisions) {
    if (!decision.node) continue;

    const verdict = provider.getVerdict({
      street: decision.street,
      hand: decision.hand,
      potBb: decision.potBb,
      toCallBb: decision.toCallBb,
      stackBb: decision.stackBb,
      available:
        decision.toCallBb > 0 ? ["fold", "call", "raise"] : ["fold", "raise"],
      node: decision.node,
    });
    if (!verdict) continue;

    const graded = gradeAction(verdict.strategy, decision.actual, {
      potBb: decision.potBb,
    });
    if (graded.grade === "best" || graded.grade === "correct") continue;

    found.push({
      handId: parsed.id,
      playedAt: parsed.playedAt,
      hand: decision.hand,
      nodeId: nodeId(decision.node),
      spot: describeSpot(decision.node),
      chosen: graded.chosen,
      expected: graded.expected,
      grade: graded.grade,
      kind: classify(graded.chosen, graded.expected),
      evLossBb: graded.evLossBb,
    });
  }

  return found;
}

function describeSpot(node: NonNullable<HeroDecision["node"]>): string {
  return node.villain ? `${node.position} vs ${node.villain}` : `${node.position} open`;
}

function classify(chosen: ActionKind, expected: ActionKind): LeakKind {
  if (expected === "fold") return "too-loose";
  if (chosen === "fold") return "too-tight";
  return "wrong-line";
}

/**
 * Group violations into named leaks, ranked.
 *
 * A leak is one (spot, kind) pair — "folding too much in the big blind against
 * the button" — because that is the unit a person can actually change.
 */
export function findLeaks(violations: readonly Violation[]): Leak[] {
  const sessionOf = assignSessions(violations);
  const groups = new Map<string, Violation[]>();

  for (const violation of violations) {
    const key = `${violation.nodeId}#${violation.kind}`;
    const group = groups.get(key);
    if (group) group.push(violation);
    else groups.set(key, [violation]);
  }

  const leaks: Leak[] = [];
  for (const [id, group] of groups) {
    const sessions = new Set(group.map((v) => sessionOf.get(v) ?? 0)).size;
    const instances = group.length;
    const confidence = confidenceOf(instances, sessions);

    const costs = group
      .map((v) => v.evLossBb)
      .filter((c): c is number => c !== undefined);
    // Only trust a total when every instance carried a cost; a partial sum
    // would understate the leak while looking authoritative.
    const totalCostBb =
      costs.length === group.length && costs.length > 0
        ? costs.reduce((a, b) => a + b, 0)
        : undefined;

    const sorted = [...group].sort(
      (a, b) => b.playedAt.getTime() - a.playedAt.getTime(),
    );

    leaks.push({
      id,
      nodeId: group[0].nodeId,
      spot: group[0].spot,
      kind: group[0].kind,
      label: `${KIND_LABELS[group[0].kind]} — ${group[0].spot}`,
      instances,
      sessions,
      handIds: sorted.map((v) => v.handId),
      hands: [...new Set(sorted.map((v) => v.hand))],
      // `sorted` is newest-first, so the head is the most recent occurrence.
      lastSeenAt: sorted[0].playedAt,
      confidence,
      // Every verified violation is worth practising. See LeakConfidence: the
      // sample-size caution belongs to estimated statistics, not to a decision
      // that was demonstrably outside the range.
      drillable: true,
      totalCostBb,
      // Real EV wins outright when every instance carries it. Otherwise fall
      // back to frequency times the ordering weight for this kind of error.
      score: totalCostBb ?? instances * KIND_WEIGHTS[group[0].kind],
    });
  }

  return leaks.sort((a, b) => b.score - a.score);
}

function confidenceOf(instances: number, sessions: number): LeakConfidence {
  if (instances >= CONFIRMED_INSTANCES && sessions >= CONFIRMED_SESSIONS) {
    return "confirmed";
  }
  if (instances >= MIN_INSTANCES && sessions >= MIN_SESSIONS) return "likely";
  return "watching";
}

/**
 * Which sitting each violation belongs to.
 *
 * Hands are ordered by time and split wherever the gap exceeds the session
 * threshold, so "three times across three evenings" can be told apart from
 * "three times in ten minutes while on tilt".
 */
function assignSessions(violations: readonly Violation[]): Map<Violation, number> {
  const ordered = [...violations].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime(),
  );
  const assigned = new Map<Violation, number>();

  let session = 0;
  let previous: number | null = null;
  const gapMs = SESSION_GAP_MINUTES * 60_000;

  for (const violation of ordered) {
    const at = violation.playedAt.getTime();
    if (previous !== null && at - previous > gapMs) session++;
    assigned.set(violation, session);
    previous = at;
  }

  return assigned;
}
