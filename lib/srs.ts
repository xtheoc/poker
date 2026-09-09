/**
 * The scheduler. One card table for preflop nodes, misplayed hands, and book
 * concepts alike.
 *
 * We use FSRS-6 through `ts-fsrs` rather than writing an SM-2. In the largest
 * public benchmark — roughly 350 million reviews — SM-2 places second to last,
 * beaten only by a constant-prediction baseline. FSRS also implements the
 * empirical spacing curve directly, so intervals should never be hand-tuned
 * here; the only knob worth touching is desired retention.
 *
 * The interesting problem is not scheduling, which the library owns. It is
 * **translating poker performance into a review rating**, since FSRS wants to
 * know how well you remembered something and a drill knows how well you played.
 * That mapping is the rest of this file, and it is where the judgement lives.
 */

import {
  type Card,
  type FSRSParameters,
  type Grade,
  Rating,
  type RecordLogItem,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
} from "ts-fsrs";
import type { ActionGrade } from "./poker/grading";

export { Rating, State };
export type { Card, Grade };

/**
 * Scheduler parameters.
 *
 * `enable_fuzz` is deliberately flipped on against the library default. Without
 * it every card learned on the same day comes due on the same day forever, and
 * the queue turns into a series of spikes and empty stretches — which is how a
 * daily habit dies. Weights are never hardcoded: `generatorParameters()` owns
 * them, so a library upgrade or a per-user retrain is picked up automatically.
 */
export function schedulerParams(
  overrides: Partial<FSRSParameters> = {},
): FSRSParameters {
  return generatorParameters({ enable_fuzz: true, ...overrides });
}

export function scheduler(overrides: Partial<FSRSParameters> = {}) {
  return fsrs(schedulerParams(overrides));
}

/** A brand-new card, due immediately. */
export function newCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/**
 * Apply a review and get back the updated card plus the log row to append.
 *
 * Takes a `Grade` rather than a `Rating`: the library reserves `Rating.Manual`
 * for rescheduling a card by hand, which is not a review and must not be able
 * to arrive here by accident.
 */
export function review(
  card: Card,
  rating: Grade,
  now: Date = new Date(),
  overrides: Partial<FSRSParameters> = {},
): RecordLogItem {
  return scheduler(overrides).next(card, now, rating);
}

/**
 * One drilled hand within a card's review.
 *
 * A card is a *node* — "CO opening at 100bb" — and reviewing it means drilling
 * several hands from that node. So a rating is computed from a handful of these
 * rather than from a single right-or-wrong.
 */
export interface DrillResult {
  grade: ActionGrade;
  /** The grader's score for this hand, in [-1, 1]. */
  score: number;
  /** How long the answer took. */
  durationMs: number;
}

/**
 * Answer times that separate knowing from working it out.
 *
 * A preflop decision that is genuinely memorised is near-instant. One that
 * takes eight seconds was *derived*, not recalled — and FSRS has no input for
 * latency, so the only way that fact reaches the scheduler is through the
 * rating. Without this, a slow correct answer looks identical to a fast one and
 * the card's interval grows as though it were solid, which is exactly how you
 * end up forgetting it.
 */
export const FAST_ANSWER_MS = 3_000;
export const SLOW_ANSWER_MS = 8_000;

/** Mean score below which a session counts as a lapse rather than a wobble. */
export const LAPSE_SCORE = 0.2;
/** Mean score below which a session was shaky but not a failure. */
export const SHAKY_SCORE = 0.6;
/** Mean score at or above which a session was clean enough to accelerate. */
export const CLEAN_SCORE = 0.95;

/** Stability, in days, past which a card counts as genuinely established. */
export const ESTABLISHED_STABILITY_DAYS = 21;

const GRADE_SEVERITY: Record<ActionGrade, number> = {
  best: 0,
  correct: 1,
  inaccuracy: 2,
  wrong: 3,
  blunder: 4,
};

/**
 * Turn a drill session into an FSRS rating.
 *
 * The shape of the judgement, in order of what overrides what:
 *
 * 1. **A blunder is a lapse, however well the rest went.** Four clean hands and
 *    one hand stacked off with a holding that should never have been played is
 *    not an 80% session — the blunder is the thing that costs money, and the
 *    card needs to come back tomorrow.
 * 2. **Any out-of-strategy action caps the session at Hard.** It was recalled,
 *    but not reliably.
 * 3. **Slow answers cap at Hard too.** Derived is not remembered.
 * 4. **Easy is reserved for fast, clean sessions on already-established cards**,
 *    otherwise a lucky first review pushes a card weeks out before it has been
 *    demonstrated at all.
 */
export function sessionRating(
  results: readonly DrillResult[],
  card?: Card,
): Grade {
  if (results.length === 0) return Rating.Again;

  const meanScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const worst = results.reduce(
    (acc, r) => (GRADE_SEVERITY[r.grade] > GRADE_SEVERITY[acc] ? r.grade : acc),
    "best" as ActionGrade,
  );
  const medianMs = median(results.map((r) => r.durationMs));

  if (worst === "blunder" || meanScore < LAPSE_SCORE) return Rating.Again;

  if (worst === "wrong" || meanScore < SHAKY_SCORE || medianMs > SLOW_ANSWER_MS) {
    return Rating.Hard;
  }

  const established =
    card !== undefined &&
    card.state === State.Review &&
    card.stability >= ESTABLISHED_STABILITY_DAYS;

  if (meanScore >= CLEAN_SCORE && medianMs <= FAST_ANSWER_MS && established) {
    return Rating.Easy;
  }

  return Rating.Good;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * A card waiting in the queue, with just enough context to rank it.
 *
 * `leakCostBb` is what makes this queue different from a generic flashcard app:
 * a node the hand history says is actively costing money outranks one that is
 * merely due. Cards not tied to a leak carry zero and rank on overdueness alone.
 */
export interface QueueEntry {
  id: string;
  due: Date;
  /** Accumulated cost of the leak this card exists to fix, in big blinds. */
  leakCostBb: number;
}

/**
 * How much a leak's cost can bump a card up the queue, in days of overdueness.
 *
 * Capped on purpose. An expensive leak should jump the queue, but it must not
 * monopolise it — memory decays on its own schedule, and letting one costly
 * node starve everything else would trade a small leak for a large one.
 */
export const MAX_LEAK_PRIORITY_DAYS = 7;

/** Big blinds of leak cost worth one day of queue priority. */
export const BB_PER_PRIORITY_DAY = 5;

/**
 * Rank the queue: most overdue first, with expensive leaks pulled forward.
 *
 * Overdueness is measured in days so the two terms are commensurable — the
 * whole point is to compare "three days late" against "costing me two big
 * blinds a session" on a single scale.
 */
export function queuePriority(entry: QueueEntry, now: Date = new Date()): number {
  const overdueDays = (now.getTime() - entry.due.getTime()) / 86_400_000;
  const leakBonus = Math.min(
    MAX_LEAK_PRIORITY_DAYS,
    Math.max(0, entry.leakCostBb) / BB_PER_PRIORITY_DAY,
  );
  return overdueDays + leakBonus;
}

/**
 * Today's session: due cards, most urgent first, capped.
 *
 * The cap is the feature. A five-to-ten minute session that is always
 * completable is worth far more than an honest backlog that gets skipped —
 * consistency is what the spacing effect actually rewards, and a queue showing
 * two hundred due cards is one a person stops opening.
 */
export function selectQueue<T extends QueueEntry>(
  entries: readonly T[],
  limit: number,
  now: Date = new Date(),
): T[] {
  return entries
    .filter((e) => e.due.getTime() <= now.getTime())
    .sort((a, b) => queuePriority(b, now) - queuePriority(a, now))
    .slice(0, limit);
}
