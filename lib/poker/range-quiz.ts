/**
 * Marking a whole range drawn from memory.
 *
 * The quickfire drill asks "this hand, this seat — what now?", which trains
 * recognition one spot at a time. This asks the other question: *draw me the
 * cutoff's opening range*. They are genuinely different skills, and the second
 * is the one that transfers, because at a table you are never asked about a
 * hand in isolation — you are asked whether the hand you were dealt falls
 * inside a shape you are holding in your head.
 *
 * **A range is drawn with actions, not with membership.** It used to be graded
 * as a single set: in, or out. That was right while every hand in every range
 * was a raise, and stopped being right the moment the charts took the book's
 * limping rules — under the gun limps 22-66 and raises everything else, and the
 * button behind three limpers splits its range in two. Knowing that 44 is "in"
 * the under-the-gun range while raising it is not knowing the range; it is the
 * exact mistake the limping rule exists to prevent.
 *
 * Three kinds of error, kept apart deliberately, because they cost differently.
 * **Missed** hands are ones the range plays that you left out; folding those
 * gives up what the hand would have made. **Extra** hands are ones you added
 * that the range folds; playing those loses money outright, and at micro stakes
 * that is the more expensive mistake by a distance. **Wrong action** hands you
 * had in the range but marked the other way — the cheapest of the three, and
 * still an error, since raising a hand meant to limp is how a small pair ends
 * up heads-up out of position. One "91% right" would average all three into a
 * number that hides which of them you actually made.
 */

import { type ChartNode, bestAction, strategyFor } from "./charts";
import { type Hand, allHands, combosOf } from "./hands";

/**
 * What a hand can be marked as.
 *
 * Narrower than `ActionKind` on purpose: folding is the absence of a mark, and
 * an all-in has no meaning at an opening node. Anything the chart plays for
 * more than a call reads as a raise here — a range grid says how a hand enters
 * the pot, not for how much.
 */
export type MarkAction = "raise" | "call";

/** A drawn range: every hand marked, and how. Unmarked hands are folds. */
export type Marks = ReadonlyMap<Hand, MarkAction>;

/** The range a node plays, hand by hand, with the action it plays it for. */
export function rangeOf(node: ChartNode): Map<Hand, MarkAction> {
  const range = new Map<Hand, MarkAction>();
  for (const hand of allHands()) {
    const action = bestAction(strategyFor(node, hand));
    if (action === "fold") continue;
    range.set(hand, action === "call" ? "call" : "raise");
  }
  return range;
}

export interface QuizResult {
  /** In the range, left unmarked. */
  missed: Hand[];
  /** Marked, but the range folds them. */
  extra: Hand[];
  /** In the range and marked, with the other action. */
  wrongAction: Hand[];
  /** Marked with the right action. */
  hit: number;
  /** Hands in the real range. */
  total: number;
  perfect: boolean;
  /**
   * How wrong it was, weighted by combinations rather than by hand classes.
   *
   * Missing AKo is a bigger error than missing 22 — twelve combinations against
   * six — and counting classes calls them equal. This is the number that says
   * how much of the range was actually wrong.
   */
  combosWrong: number;
  /** The right answer, so a mistake can be shown as what it should have been. */
  expected: ReadonlyMap<Hand, MarkAction>;
}

/** Compare a drawn range against the real one. */
export function gradeSelection(node: ChartNode, marks: Marks): QuizResult {
  const real = rangeOf(node);
  const missed: Hand[] = [];
  const extra: Hand[] = [];
  const wrongAction: Hand[] = [];
  let hit = 0;

  // Walked in `allHands` order so the lists come back strongest first, which is
  // the order anyone reads a range in.
  for (const hand of allHands()) {
    const wanted = real.get(hand);
    const chose = marks.get(hand);
    if (wanted && chose === wanted) hit++;
    else if (wanted && chose) wrongAction.push(hand);
    else if (wanted) missed.push(hand);
    else if (chose) extra.push(hand);
  }

  const combosWrong = [...missed, ...extra, ...wrongAction].reduce(
    (sum, hand) => sum + combosOf(hand),
    0,
  );

  return {
    missed,
    extra,
    wrongAction,
    hit,
    total: real.size,
    perfect:
      missed.length === 0 && extra.length === 0 && wrongAction.length === 0,
    combosWrong,
    expected: real,
  };
}
