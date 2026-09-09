/**
 * Choosing which hands to drill at a node.
 *
 * Reviewing a card means drilling a handful of hands from one spot, so this is
 * the code that decides which handful. It matters more than it looks: sampling
 * naively — across all 1,326 combinations, weighted by how often each hand is
 * dealt — produces a drill that is roughly 85% folding trash. That is a
 * faithful simulation of poker and a terrible way to learn it. You would spend
 * the session confirming that 72o folds, which you already knew, and almost
 * never see the hands whose classification you actually get wrong.
 *
 * So the sampler deliberately over-weights hands near the edge of the range and
 * hands this player has been getting wrong. That is a desirable difficulty
 * rather than a distortion: the goal is not to reproduce the distribution of
 * hands you are dealt, it is to reproduce the distribution of *decisions you
 * find hard*.
 */

import {
  type ChartNode,
  type Strategy,
  activeActions,
  isMixed,
  strategyFor,
} from "./charts";
import { type Hand, allHands, combosOf } from "./hands";

export interface DrillHand {
  hand: Hand;
  strategy: Strategy;
  /**
   * The 1–100 roll shown alongside a mixed node, so the correct action is
   * decidable. Absent for pure strategies, where there is nothing to randomise.
   */
  roll?: number;
}

export interface SampleOptions {
  /**
   * Share of drilled hands taken from the hands the chart actually plays.
   *
   * The natural rate at most nodes is well under a quarter, which is why this
   * exists. Half is the default: enough folds that the range still has an edge
   * to feel, without the session being mostly trash.
   */
  playRatio?: number;
  /**
   * Hands this player has previously got wrong at this node, and how often.
   *
   * This is the fine-grained targeting that per-hand cards would have bought at
   * the cost of an unlearnable 14,000-card deck. The error counts live in the
   * review log and steer sampling only — they never reach the scheduler.
   */
  errorCounts?: ReadonlyMap<Hand, number>;
  /** Injectable randomness, so tests are deterministic. */
  rng?: () => number;
}

/** How much a single past error multiplies a hand's chance of being drilled. */
export const ERROR_WEIGHT_PER_MISS = 1.5;

/** Ceiling on that multiplier, so one bad night cannot monopolise the drill. */
export const MAX_ERROR_MULTIPLIER = 6;

/**
 * Pick hands to drill at a node.
 *
 * Never returns the same hand twice: repetition inside one short session tests
 * nothing and reads as a bug.
 */
export function sampleDrillHands(
  node: ChartNode,
  count: number,
  options: SampleOptions = {},
): DrillHand[] {
  const { playRatio = 0.5, errorCounts, rng = Math.random } = options;

  const played: Hand[] = [];
  const folded: Hand[] = [];
  for (const hand of allHands()) {
    const actions = activeActions(strategyFor(node, hand));
    const isFoldOnly = actions.length === 1 && actions[0] === "fold";
    (isFoldOnly ? folded : played).push(hand);
  }

  // Rounded probabilistically rather than to nearest, because the quickfire
  // drill asks for one hand at a time. Rounding 1 x 0.5 to nearest gives 1
  // every single time, so every dealt spot would be a hand the chart plays and
  // the drill would quietly teach "always play". Splitting on the remainder
  // keeps the ratio right in expectation at any count.
  const exactPlayed = count * playRatio;
  const wantPlayed = Math.floor(exactPlayed) + (rng() < exactPlayed % 1 ? 1 : 0);
  const fromPlayed = drawWithoutReplacement(
    played,
    Math.min(wantPlayed, played.length),
    (h) => weightOf(h, errorCounts),
    rng,
  );
  const fromFolded = drawWithoutReplacement(
    folded,
    Math.min(count - fromPlayed.length, folded.length),
    (h) => weightOf(h, errorCounts),
    rng,
  );

  // Interleaved rather than grouped: a session showing every playable hand
  // first and every fold second lets you answer from position in the list
  // rather than from the hand, which trains nothing.
  const chosen = shuffle([...fromPlayed, ...fromFolded], rng);

  return chosen.map((hand) => {
    const strategy = strategyFor(node, hand);
    return {
      hand,
      strategy,
      // A die is only shown where it changes the answer. Rolling one at a pure
      // node would imply the decision is a coin flip when it is not.
      roll: isMixed(strategy) ? 1 + Math.floor(rng() * 100) : undefined,
    };
  });
}

/**
 * How likely a hand is to be picked.
 *
 * Combination count is the base — there really are three times as many ways to
 * hold AKo as AKs, and a drill ignoring that would misrepresent which decisions
 * come up. Past errors then multiply it, capped so one bad session cannot turn
 * the next month into a single hand on repeat.
 */
function weightOf(hand: Hand, errorCounts?: ReadonlyMap<Hand, number>): number {
  const base = combosOf(hand);
  const misses = errorCounts?.get(hand) ?? 0;
  const multiplier = Math.min(
    MAX_ERROR_MULTIPLIER,
    1 + misses * ERROR_WEIGHT_PER_MISS,
  );
  return base * multiplier;
}

/** Weighted sampling without replacement. */
function drawWithoutReplacement(
  pool: readonly Hand[],
  count: number,
  weight: (hand: Hand) => number,
  rng: () => number,
): Hand[] {
  const remaining = [...pool];
  const weights = remaining.map(weight);
  const picked: Hand[] = [];

  for (let n = 0; n < count && remaining.length > 0; n++) {
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) break;

    let target = rng() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      target -= weights[i];
      if (target <= 0) {
        index = i;
        break;
      }
    }

    picked.push(remaining[index]);
    remaining.splice(index, 1);
    weights.splice(index, 1);
  }

  return picked;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Error counts per hand at a node, from that node's review history.
 *
 * A plain reduction over log rows rather than a database aggregate, so the
 * sampling rule stays testable without a database.
 */
export function tallyErrors(
  rows: ReadonlyArray<{ hand: string | null; action_grade: string | null }>,
): Map<Hand, number> {
  const counts = new Map<Hand, number>();
  for (const row of rows) {
    if (!row.hand) continue;
    // Inaccuracies are not counted. They are by definition the errors that cost
    // almost nothing, and drilling them harder would spend the session on the
    // least valuable thing available.
    if (row.action_grade !== "wrong" && row.action_grade !== "blunder") continue;
    counts.set(row.hand, (counts.get(row.hand) ?? 0) + 1);
  }
  return counts;
}
