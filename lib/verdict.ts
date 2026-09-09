/**
 * "What was the right play?" — asked once, answered by whichever source can.
 *
 * This interface exists on day one, before anything implements it, because it
 * is the seam along which the platform grows. Version one answers preflop
 * questions from a hand-authored chart and river questions from minimum
 * defence frequency, and admits it does not know the rest. Later a solver
 * source is *added to the list* rather than threaded through the leak engine,
 * the drill runner and the hand reviewer separately.
 *
 * The rule that matters more than any of the mechanics: **a provider returns
 * null when it does not know.** A study tool that manufactures a confident
 * verdict from a heuristic teaches false confidence, and a beginner has no way
 * to tell the difference. Silence is a valid and often correct answer.
 */

import type { ActionKind, NodeKey, Strategy } from "./poker/charts";
import type { Hand } from "./poker/hands";

/**
 * Where a verdict came from.
 *
 * Surfaced in the UI verbatim — the user is always told whether they are
 * looking at a chart lookup, an arithmetic result, or a model's opinion.
 */
export type VerdictSource = "chart" | "mdf" | "solver" | "heuristic" | "llm";

/**
 * How much weight a verdict carries.
 *
 * - `exact`     deterministic given the inputs; a chart lookup or pot arithmetic
 * - `high`      derived from sound theory with stated assumptions, e.g. MDF
 * - `medium`    a defensible rule of thumb
 * - `low`       an opinion worth reading, not worth drilling
 *
 * Only `exact` and `high` verdicts may generate drill cards; everything below
 * is shown as commentary. This is the same principle as the sample-size gate on
 * statistics — better to say nothing than to drill a guess.
 */
export type Confidence = "exact" | "high" | "medium" | "low";

export const DRILLABLE_CONFIDENCE: readonly Confidence[] = ["exact", "high"];

export function isDrillable(confidence: Confidence): boolean {
  return DRILLABLE_CONFIDENCE.includes(confidence);
}

export type Street = "preflop" | "flop" | "turn" | "river";

/**
 * One point at which the hero had to act.
 *
 * These are the atoms of the whole analysis layer: a hand history is parsed
 * into a list of them, a drill generates them synthetically, and both go
 * through the same providers. One shape for real and synthetic decisions is
 * what lets a drill be built from a leak and a leak be confirmed by a drill.
 */
export interface DecisionPoint {
  street: Street;
  /** The hero's two cards as a hand class. */
  hand: Hand;
  /** Pot in big blinds before the hero acts. */
  potBb: number;
  /** Price of continuing, in big blinds. Zero when checking is free. */
  toCallBb: number;
  /** Hero's remaining stack in big blinds. */
  stackBb: number;
  /** Actions actually available, so a provider never suggests an illegal one. */
  available: ActionKind[];
  /**
   * The preflop node this decision sits at.
   *
   * Present only when the decision maps onto a charted preflop spot — which is
   * exactly when the chart provider can answer with certainty.
   */
  node?: NodeKey;
  /** Board cards, for postflop decisions. */
  board?: string[];
}

export interface Verdict {
  source: VerdictSource;
  confidence: Confidence;
  /**
   * The full action distribution, not just a recommendation.
   *
   * Sources that only know one action express it as a pure strategy. Keeping
   * the same shape everywhere means the feedback panel, the grader and the
   * leak engine never care which source answered.
   */
  strategy: Strategy;
  /** The action this verdict considers best. */
  best: ActionKind;
  /** Plain-language reasoning, shown to the user as-is. */
  rationale: string;
  /**
   * What this verdict assumes, when it assumes anything.
   *
   * MDF assumes the opponent's bluffs have no equity, which is true on the
   * river and false earlier. Stating assumptions is how a heuristic stays
   * honest instead of hardening into a rule.
   */
  assumptions?: string[];
}

export interface VerdictProvider {
  readonly source: VerdictSource;
  /**
   * Answer, or decline.
   *
   * Returning null is the normal case for most providers on most decisions and
   * carries no penalty. Guessing does.
   */
  getVerdict(decision: DecisionPoint): Promise<Verdict | null> | Verdict | null;
}

/**
 * A provider that always answers immediately.
 *
 * Worth distinguishing in the type system rather than leaving to convention:
 * the deterministic pass runs over every preflop decision in every hand ever
 * imported, and it can only do that cheaply because the chart never awaits
 * anything. A caller checking thousands of decisions in a loop asks for this
 * type and gets a compile error if a source that talks to a network is ever
 * substituted in.
 */
export interface SyncVerdictProvider extends VerdictProvider {
  getVerdict(decision: DecisionPoint): Verdict | null;
}

const CONFIDENCE_RANK: Record<Confidence, number> = {
  exact: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/**
 * Ask each provider in turn and keep the most confident answer.
 *
 * Providers are consulted in the order given, and the search stops as soon as
 * one returns an `exact` verdict: nothing can improve on a deterministic
 * answer, and the later providers in the list are the expensive ones. A model
 * should never be asked about a spot a chart has already settled — that
 * ordering is what keeps the model bill proportional to the hands genuinely
 * needing judgement.
 */
export async function resolveVerdict(
  providers: readonly VerdictProvider[],
  decision: DecisionPoint,
): Promise<Verdict | null> {
  let best: Verdict | null = null;

  for (const provider of providers) {
    const verdict = await provider.getVerdict(decision);
    if (!verdict) continue;

    if (
      best === null ||
      CONFIDENCE_RANK[verdict.confidence] > CONFIDENCE_RANK[best.confidence]
    ) {
      best = verdict;
    }
    if (best.confidence === "exact") break;
  }

  return best;
}

/**
 * The share of the pot a bettor risks, which is also the frequency at which a
 * bluff must succeed to break even.
 */
export function alpha(betBb: number, potBb: number): number {
  if (betBb <= 0 || potBb < 0) return 0;
  return betBb / (betBb + potBb);
}

/**
 * Minimum defence frequency: defend less often than this and the opponent can
 * profitably bet any two cards.
 *
 * This is the one rigorous postflop yardstick available without a solver, and
 * it is why the river gets real analysis in version one while the flop and turn
 * do not. Callers must respect `mdfAppliesTo`.
 */
export function mdf(betBb: number, potBb: number): number {
  return 1 - alpha(betBb, potBb);
}

/**
 * Whether an MDF-based verdict is sound on this street.
 *
 * Only the river. On the flop and turn a bluff still holds equity, so the
 * defender does not need to reach the MDF figure to avoid being exploited, and
 * quoting it there would flag disciplined folds as leaks. Getting this wrong
 * would make the leak engine confidently wrong on two streets out of four.
 */
export function mdfAppliesTo(street: Street): boolean {
  return street === "river";
}
