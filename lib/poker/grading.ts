/**
 * Grading a preflop decision.
 *
 * The hard problem this solves is that a mixed strategy is not gradeable on its
 * own. If the chart raises a hand 30% of the time, a player who raises it is
 * neither right nor wrong, and a trainer that calls it either is teaching a
 * falsehood. The fix, which every serious trainer converges on, is an **RNG
 * die**: show a 1–100 roll alongside the spot, and the correct action becomes
 * deterministic given the roll. The player learns the frequency *and* the
 * discipline of executing it, and the grader gets a single right answer.
 *
 * Version one ships pure strategies, so the die will rarely fire. It is built
 * now anyway because the grader's whole shape depends on it, and bolting it on
 * later would mean rewriting this module and re-interpreting every review
 * already recorded against it.
 *
 * Grading is joint over **frequency and EV loss**, not either alone. Binary
 * right/wrong is incoherent at mixed nodes. Raw EV loss is correctly weighted
 * but useless as feedback, because almost every preflop error costs between
 * 0.02 and 0.3 big blinds and humans have no intuition for that range. So the
 * frequency axis teaches *what the strategy is*, the EV axis teaches *what the
 * mistake costs*, and the buckets below combine them.
 */

import {
  ACTIONS,
  type ActionKind,
  type Strategy,
  activeActions,
  bestAction,
  bestEv,
  freqOf,
  isMixed,
} from "./charts";

/**
 * Outcome buckets.
 *
 * - `best`        the highest-frequency action, or the one the die demanded
 * - `correct`     genuinely part of the strategy, just not the modal choice
 * - `inaccuracy`  technically in the strategy but rare, and cheap to get wrong
 * - `wrong`       never taken by the strategy
 * - `blunder`     never taken *and* expensive
 */
export type ActionGrade = "best" | "correct" | "inaccuracy" | "wrong" | "blunder";

/**
 * Below this frequency an action is real but marginal.
 *
 * Follows the convention established by the mainstream trainers, which treat
 * sub-3.5% actions as inaccuracies rather than errors: they appear in the
 * solution, but a human who never takes them loses almost nothing.
 */
export const INACCURACY_MAX_FREQ = 0.035;

/**
 * EV loss, as a share of the pot, above which a non-strategy action is a blunder.
 *
 * Expressed against the pot rather than in big blinds so that it means the same
 * thing in a 2.5bb open and a 25bb 4-bet pot. Without this normalisation a
 * fixed bb threshold would call every 3-bet-pot error a blunder and every
 * open-raise error trivial.
 */
export const BLUNDER_EV_LOSS_POT_SHARE = 0.15;

/** Fallback threshold in big blinds, for when the pot size is not known. */
export const BLUNDER_EV_LOSS_BB = 0.5;

export interface GradeOptions {
  /**
   * The 1–100 roll shown to the player, for mixed nodes.
   *
   * When absent at a mixed node the modal action is treated as best, which is
   * the right behaviour for reviewing a hand that was already played: no die
   * was rolled at the table, so there is nothing to have disobeyed.
   */
  roll?: number;
  /** Pot in big blinds at the moment of the decision. */
  potBb?: number;
}

export interface GradedAction {
  grade: ActionGrade;
  chosen: ActionKind;
  /** What would have scored `best` — the modal action, or the die's demand. */
  expected: ActionKind;
  /** How often the strategy takes the chosen action. */
  freq: number;
  /** EV given up, in big blinds. Undefined when the source carries no EV. */
  evLossBb?: number;
  /**
   * Score in [-1, 1], deliberately non-linear.
   *
   * Correct play is rewarded intensely and inaccuracy punished harshly, rather
   * than both being scaled linearly by frequency. A linear score makes a 45%
   * action feel like a near-failure when it is in fact fine, which trains
   * hesitancy — the opposite of what a frequency-based strategy needs.
   */
  score: number;
  /** Why this grade, in words the UI can show directly. */
  rationale: string;
}

/**
 * Which action the die demands, given a roll in 1–100.
 *
 * Actions are laid end to end from passive to aggressive in proportion to their
 * frequency, so a strategy of fold 30% / call 20% / raise 50% maps rolls 1–30
 * to folding, 31–50 to calling and 51–100 to raising. Aggression sits at the
 * high end by convention, matching the trainers that show a die, so moving
 * between tools does not mean relearning which end means what.
 */
export function rngCorrectAction(strategy: Strategy, roll: number): ActionKind {
  const active = activeActions(strategy);
  if (active.length === 0) return "fold";

  const clamped = Math.min(100, Math.max(1, Math.round(roll)));
  let cumulative = 0;
  for (const action of active) {
    cumulative += freqOf(strategy, action) * 100;
    // The epsilon keeps a roll landing exactly on a boundary with the action
    // that owns that boundary, rather than losing it to floating-point drift.
    if (clamped <= cumulative + 1e-9) return action;
  }
  // Frequencies summing just under 1 can leave the top roll unclaimed; the
  // most aggressive live action owns the remainder.
  return active[active.length - 1];
}

/** Grade one decision against the strategy the chart prescribes. */
export function gradeAction(
  strategy: Strategy,
  chosen: ActionKind,
  options: GradeOptions = {},
): GradedAction {
  const mixed = isMixed(strategy);
  const useDie = mixed && options.roll !== undefined;
  const expected = useDie
    ? rngCorrectAction(strategy, options.roll!)
    : bestAction(strategy);

  const freq = freqOf(strategy, chosen);
  const evLossBb = evLossOf(strategy, chosen);

  if (chosen === expected) {
    return {
      grade: "best",
      chosen,
      expected,
      freq,
      evLossBb,
      score: 1,
      rationale: useDie
        ? `The die rolled ${options.roll}, which calls for ${chosen}.`
        : sentence(`${chosen} is the most frequent action here at ${percent(freq)}.`),
    };
  }

  // Missing the die's demand while still choosing a real action is a failure of
  // execution, not of knowledge. The player knew the strategy; they just did
  // not follow the randomiser, so it is scored down but not marked an error.
  if (useDie && freq > INACCURACY_MAX_FREQ) {
    return {
      grade: "correct",
      chosen,
      expected,
      freq,
      evLossBb,
      score: rewardCurve(freq) * 0.8,
      rationale: sentence(
        `${chosen} is part of the strategy at ${percent(freq)}, but the die rolled ${options.roll}, which called for ${expected}.`,
      ),
    };
  }

  if (freq > INACCURACY_MAX_FREQ) {
    return {
      grade: "correct",
      chosen,
      expected,
      freq,
      evLossBb,
      score: rewardCurve(freq),
      rationale: sentence(
        `${chosen} is a real part of the strategy at ${percent(freq)}, though ${expected} is taken more often.`,
      ),
    };
  }

  if (freq > 0) {
    return {
      grade: "inaccuracy",
      chosen,
      expected,
      freq,
      evLossBb,
      score: -0.2,
      rationale: sentence(
        `${chosen} appears only ${percent(freq)} of the time. It costs little, but ${expected} is the play.`,
      ),
    };
  }

  const blunder = isBlunder(evLossBb, options.potBb);
  return {
    grade: blunder ? "blunder" : "wrong",
    chosen,
    expected,
    freq,
    evLossBb,
    score: blunder ? -1 : -0.6,
    rationale: blunder
      ? sentence(
          `${chosen} is never correct here, and it costs enough to matter. The play is ${expected}.`,
        )
      : sentence(`${chosen} is not part of the strategy here. The play is ${expected}.`),
  };
}

/** Capitalise a rationale that starts with an action name. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * EV given up by choosing this action, when the chart knows EV at all.
 *
 * Authored charts do not carry EV, so this is undefined for every v1 grade and
 * the frequency axis does all the work. It begins returning real numbers the
 * moment a solver-derived chart set is installed, with no other change.
 */
function evLossOf(strategy: Strategy, chosen: ActionKind): number | undefined {
  const best = bestEv(strategy);
  if (best === undefined) return undefined;
  const chosenEv = strategy[chosen]?.ev;
  // An action the chart does not price is assumed to forfeit the whole edge
  // rather than to be free, which is the conservative reading.
  if (chosenEv === undefined) return best;
  return Math.max(0, best - chosenEv);
}

/**
 * Whether an out-of-strategy action is the expensive kind.
 *
 * **A blunder requires knowing the cost, so without EV there are none.** That
 * looks like a limitation and is actually the honest reading. Almost no preflop
 * error is catastrophic: opening T7o on the button where the chart folds it
 * gives up a fraction of a big blind. If every out-of-range action were called
 * a blunder, the word would mean nothing — opening T7o would carry the same
 * label as opening 32o under the gun, and any session containing one would be
 * scheduled as a failure. Crying wolf teaches a beginner to distrust the
 * grader, which is worse than not grading at all.
 *
 * So authored charts, carrying no EV, top out at "wrong". The category
 * activates on its own the moment a source supplies EV — which in practice
 * means postflop, where blunders genuinely live: stacking off drawing dead
 * costs whole buy-ins, not fractions of a blind.
 */
function isBlunder(
  evLossBb: number | undefined,
  potBb: number | undefined,
): boolean {
  if (evLossBb === undefined) return false;
  const threshold =
    potBb !== undefined && potBb > 0
      ? potBb * BLUNDER_EV_LOSS_POT_SHARE
      : BLUNDER_EV_LOSS_BB;
  return evLossBb >= threshold;
}

/**
 * Concave reward for taking a correct-but-not-modal action.
 *
 * The square root is what makes the scale reward correct play intensely: an
 * action taken 25% of the time scores 0.5 rather than 0.25, because a player
 * who found a quarter-frequency line understood the spot, and scoring it as
 * one-quarter-right would teach them not to look for it again.
 */
function rewardCurve(freq: number): number {
  return Math.sqrt(Math.min(1, Math.max(0, freq)));
}

function percent(freq: number): string {
  return `${Math.round(freq * 100)}%`;
}

/**
 * The full frequency vector, for the feedback panel shown after every answer.
 *
 * Immediate feedback is one of the conditions under which retrieval practice
 * measurably strengthens memory, so this is not decoration — it is the part of
 * the drill that makes the testing effect work.
 */
export function strategyBreakdown(
  strategy: Strategy,
): Array<{ action: ActionKind; freq: number; ev?: number }> {
  return ACTIONS.filter((a) => freqOf(strategy, a) > 0).map((action) => ({
    action,
    freq: freqOf(strategy, action),
    ev: strategy[action]?.ev,
  }));
}
