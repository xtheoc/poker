/**
 * Preflop charts: the strategy a node prescribes, and the identity of a node.
 *
 * Two design decisions here carry the whole platform's ability to grow, and
 * both cost almost nothing now while being expensive to retrofit later.
 *
 * First, a strategy is a *probability vector over actions with optional EV*,
 * not a single recommended action. Version one ships hand-authored pure
 * strategies — every hand is 100% one action — because mixed frequencies are
 * unlearnable for a beginner and irrelevant at NL2, where opponents' errors
 * dwarf equilibrium deviations. But the shape is already the shape a solver
 * emits, so a solver-derived chart set drops in later without touching the
 * grader, the drill sampler, or the schema.
 *
 * Second, a node's identity is independent of the chart set that describes it.
 * A node is a *situation* — "CO opening at 100bb" — and situations do not
 * change when we publish better numbers for them. Scheduler cards key on node
 * identity, so replacing a chart set re-grades your history instead of
 * orphaning every card you have ever reviewed.
 */

import type { Hand } from "./hands";

/** Seats at a 6-max table, in order of action preflop. */
export const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"] as const;

export type Position = (typeof POSITIONS)[number];

/**
 * Seats in the order they act *after* the flop, which is not the order above.
 *
 * The blinds act first once the flop is out, having acted last before it. That
 * inversion is the whole reason the blinds lose money, and it is what "in
 * position" means — so it needs its own list rather than an offset into the
 * preflop one.
 */
const POSTFLOP_ORDER: readonly Position[] = [
  "SB",
  "BB",
  "UTG",
  "HJ",
  "CO",
  "BTN",
];

/**
 * True when the hero acts after the villain on every street that matters.
 *
 * Several rules turn on this, and read off the preflop order they would be
 * subtly wrong: the small blind acts before the button preflop and after it on
 * every later street, so a naive comparison calls the small blind "in position"
 * against most of the table.
 */
export function isInPosition(hero: Position, villain: Position): boolean {
  return POSTFLOP_ORDER.indexOf(hero) > POSTFLOP_ORDER.indexOf(villain);
}

/**
 * Actions available at a preflop node.
 *
 * Ordered passive to aggressive, which is not cosmetic: the RNG die walks this
 * order to turn a mixed strategy into a gradeable single answer, so changing
 * the order silently changes what the die considers correct.
 */
export const ACTIONS = ["fold", "call", "raise", "allin"] as const;

export type ActionKind = (typeof ACTIONS)[number];

/**
 * The situations a chart covers.
 *
 * Version one populates `rfi` and `vs-rfi` only — twenty nodes, and the ones
 * where a beginner's money actually goes. The rest are declared now so the
 * type never has to change when the tree expands toward its full ~85 nodes.
 */
export const SCENARIOS = [
  "rfi",
  // A pot nobody has raised but several players have limped into. Its own
  // scenario rather than a variant of `rfi`, because the right play genuinely
  // differs: a hand you open for a raise when folded to can be worth limping
  // behind three others, and one node cannot hold both answers.
  "vs-limp",
  "vs-rfi",
  "vs-3bet",
  "squeeze",
  "vs-4bet",
  "bvb",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export interface ActionStrategy {
  /** How often this action is taken, in [0,1]. */
  freq: number;
  /**
   * Expected value in big blinds, when the source knows it.
   *
   * Undefined for authored charts, which express what to do but not what the
   * alternatives cost. Grading degrades gracefully to frequency-only when this
   * is absent, and sharpens automatically when a solver source supplies it.
   */
  ev?: number;
}

/**
 * A hand's strategy at one node: action → frequency and EV.
 *
 * Actions absent from the map have frequency zero. A hand absent from a node's
 * strategy map folds 100% of the time — charts are stored sparsely because
 * most of the 169 hands fold at most nodes, and writing that out would triple
 * the size of every chart for no information.
 */
export type Strategy = Partial<Record<ActionKind, ActionStrategy>>;

/** The strategy assumed for any hand a chart does not mention. */
export const FOLD_EVERYTHING: Strategy = { fold: { freq: 1 } };

/**
 * A node's stable identity, independent of any chart set.
 *
 * Deliberately excludes the chart set and its version. See the module header:
 * this is what lets charts be replaced without resetting review history.
 */
export interface NodeKey {
  scenario: Scenario;
  /** The seat the hero is acting from. */
  position: Position;
  /** The opponent whose action created this spot; absent for an unopened pot. */
  villain?: Position;
  /**
   * Players who called the original open before the hero acts.
   *
   * This only belongs to a squeeze node. Their identities are part of the
   * situation, not decorative table state: a BB squeeze over UTG and BTN is a
   * different decision from squeezing UTG and two callers, and the table must
   * show where the dead money came from.
   */
  callers?: readonly Position[];
  /** Effective stack in big blinds. */
  stackBb: number;
  /** Which betting-tree convention this node belongs to, e.g. "6max-2.5x". */
  treeId: string;
}

export type NodeId = string;

/**
 * Render a node key as a stable string id.
 *
 * The format is readable on purpose — it shows up in database rows, drill URLs
 * and debugging output, and an opaque hash would make every one of those
 * harder to reason about for no benefit at this scale.
 */
export function nodeId(key: NodeKey): NodeId {
  const villain = key.villain ? `-vs-${key.villain}` : "";
  const callers = key.callers?.length ? `-with-${key.callers.join("-")}` : "";
  return `${key.treeId}/${key.stackBb}bb/${key.scenario}/${key.position}${villain}${callers}`;
}

export interface ChartNode {
  key: NodeKey;
  /** Sparse: hand → strategy. Unlisted hands fold. */
  strategies: Record<Hand, Strategy>;
}

/** Where a chart set's numbers came from, which drives how much to trust them. */
export type ChartProvider = "authored" | "solver" | "imported";

export interface ChartSet {
  id: string;
  /**
   * Bumped whenever the numbers change.
   *
   * Cards reference (node id, chart version) so a review recorded against
   * older numbers stays interpretable rather than being silently re-scored
   * against a strategy the user was never shown.
   */
  version: number;
  name: string;
  provider: ChartProvider;
  treeId: string;
  stackBb: number;
  /**
   * What an open costs, in big blinds.
   *
   * Part of the tree convention rather than decoration: `treeId` is literally
   * "6max-2.5x", so the size is already half of this set's identity and was
   * only ever written down in a comment. A screen that wants to show the money
   * in front of a raiser reads it here rather than hardcoding 2.5 and quietly
   * disagreeing with the charts the day a set opens to something else.
   */
  openBb: number;
  /**
   * Position-specific opening sizes where a strategy deliberately uses a
   * sizing ladder. Omitted positions use `openBb`; the small blind still uses
   * `sbOpenBb` unless it appears here.
   */
  openSizes?: Partial<Record<Position, number>>;
  /**
   * What the small blind opens to.
   *
   * Larger, because the small blind plays every later street out of position
   * against an opponent who has already declined to act.
   */
  sbOpenBb: number;
  /**
   * Honest provenance, shown in the UI.
   *
   * Authored charts are simplifications and the user is told so. A study tool
   * that presents its own approximations as solver truth teaches false
   * confidence, which is worse than teaching nothing.
   */
  notes: string;
  nodes: ChartNode[];
}

/** Blinds, in big blinds. Fixed by the game, not by the chart set. */
export const SB_POST = 0.5;
export const BB_POST = 1;

/** What a given seat opens to under this set's convention. */
export function openSizeBb(set: ChartSet, position: Position): number {
  return set.openSizes?.[position] ?? (position === "SB" ? set.sbOpenBb : set.openBb);
}

/**
 * What one seat has in front of it, in big blinds. Null for an empty spot.
 *
 * The raiser's money *replaces* the blind they posted rather than adding to
 * it, because a raise is made **to** an amount, not on top of one. That is the
 * only arithmetic mistake available here and it would be invisible if made:
 * a small blind opening would show 3.5bb, and nothing on screen would look
 * wrong. Hence a tested function rather than a conditional in a component.
 */
export function wagerBb(
  seat: Position,
  villain: Position | undefined,
  set: ChartSet,
  limpers: readonly Position[] = [],
): number | null {
  if (seat === villain) return openSizeBb(set, seat);
  // A limp is a call of the big blind, so it is one blind in front of a seat
  // that has posted nothing — which is exactly what a limper's chips look like.
  if (limpers.includes(seat)) return BB_POST;
  if (seat === "SB") return SB_POST;
  if (seat === "BB") return BB_POST;
  return null;
}

/**
 * What a 3-bet and a 4-bet cost, as multiples of the bet they answer.
 *
 * The book's numbers. Three times in position and four out of it, because out
 * of position you want fewer callers and a worse price for them; a 4-bet is
 * 2.5x whatever it re-raises.
 */
export const THREE_BET_IP = 3;
export const THREE_BET_OOP = 4;
export const FOUR_BET = 2.5;

/**
 * Everyone's money, for one node.
 *
 * Replaces reasoning about seats one at a time. Once a pot has been raised and
 * re-raised there are two live bets on the table and they depend on each other
 * — the 4-bet is a multiple of the 3-bet, which is a multiple of the open — so
 * working a single seat out in isolation means recomputing the whole line
 * anyway. Returning the lot keeps that arithmetic in one place.
 *
 * The hero appears here too. Facing a 3-bet you have already put in an open,
 * and a table that showed only the villain's raise would draw the same picture
 * as a plain open with a bigger number on it.
 */
export function wagersFor(
  node: ChartNode,
  set: ChartSet,
): Map<Position, number> {
  const { scenario, position: hero, villain } = node.key;
  const wagers = new Map<Position, number>();

  // The blinds are posted before anything else happens, and stay posted unless
  // that seat went on to raise.
  wagers.set("SB", SB_POST);
  wagers.set("BB", BB_POST);

  for (const seat of limpersFor(node)) wagers.set(seat, BB_POST);

  if (scenario === "vs-rfi" && villain) {
    wagers.set(villain, openSizeBb(set, villain));
  }

  if (scenario === "squeeze" && villain) {
    const open = openSizeBb(set, villain);
    wagers.set(villain, open);
    for (const caller of node.key.callers ?? []) wagers.set(caller, open);
  }

  if (scenario === "vs-3bet" && villain) {
    // Hero opened; villain re-raised over the top.
    const open = openSizeBb(set, hero);
    wagers.set(hero, open);
    const times = isInPosition(villain, hero) ? THREE_BET_IP : THREE_BET_OOP;
    wagers.set(villain, round(open * times));
  }

  if (scenario === "vs-4bet" && villain) {
    // Villain opened, hero 3-bet, villain 4-bet back over it.
    const open = openSizeBb(set, villain);
    const times = isInPosition(hero, villain) ? THREE_BET_IP : THREE_BET_OOP;
    const threeBet = round(open * times);
    wagers.set(hero, threeBet);
    wagers.set(villain, round(threeBet * FOUR_BET));
  }

  return wagers;
}

/** Half a big blind is the smallest unit on the table; nothing needs more. */
function round(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Who limped, for a node that describes a limped pot.
 *
 * Determinate rather than guessed. The only limped node in this set is the
 * button behind three limpers, and six-handed there is exactly one way that
 * happens: everyone who acts before the button and is not a blind. Any other
 * arrangement would be a different number of limpers and therefore a different
 * node.
 *
 * Needed because the table draws money rather than labels. Without this a
 * limped pot would be indistinguishable from a folded-round one, and the
 * question would have no readable answer.
 */
export function limpersFor(node: ChartNode): Position[] {
  if (node.key.scenario !== "vs-limp") return [];

  const hero = POSITIONS.indexOf(node.key.position);
  if (hero < 0) return [];

  return POSITIONS.slice(0, hero).filter(
    (seat) => seat !== "SB" && seat !== "BB",
  );
}

/** Players who have called an open before the hero in a squeeze spot. */
export function squeezeCallersFor(node: ChartNode): Position[] {
  return node.key.scenario === "squeeze" ? [...(node.key.callers ?? [])] : [];
}

/** Look up a node in a chart set. Returns null when the set does not cover it. */
export function findNode(set: ChartSet, id: NodeId): ChartNode | null {
  return set.nodes.find((n) => nodeId(n.key) === id) ?? null;
}

/**
 * The strategy a chart prescribes for a hand at a node.
 *
 * Never returns null: a hand the chart does not mention folds, which is the
 * whole point of storing charts sparsely.
 */
export function strategyFor(node: ChartNode, hand: Hand): Strategy {
  return node.strategies[hand] ?? FOLD_EVERYTHING;
}

/** Frequency of one action, treating absence as zero. */
export function freqOf(strategy: Strategy, action: ActionKind): number {
  return strategy[action]?.freq ?? 0;
}

/**
 * Actions taken often enough to be real.
 *
 * The epsilon exists because authored charts are written by hand and solver
 * output carries floating-point noise; an action taken 0.0001% of the time is
 * a rounding artefact, not a strategy, and drilling it would be nonsense.
 */
export const FREQ_EPSILON = 1e-6;

/** Non-zero actions, ordered passive to aggressive. */
export function activeActions(strategy: Strategy): ActionKind[] {
  return ACTIONS.filter((a) => freqOf(strategy, a) > FREQ_EPSILON);
}

/**
 * The three actions always legal preflop, whatever a node happens to prescribe.
 *
 * Folding, calling and raising are available at every preflop decision that has
 * ever existed. Whether a *chart* uses one is a different question — and one the
 * player is not supposed to be able to read off the screen.
 */
export const ALWAYS_OFFERED: readonly ActionKind[] = ["fold", "call", "raise"];

/**
 * What a drill should offer as buttons.
 *
 * **Always fold, call and raise**, plus anything else the node prescribes.
 *
 * Two opposite failures are being prevented here, which is why this reads the
 * node instead of being a constant.
 *
 * *Too few buttons.* The drill used to infer the buttons from whether there was
 * a raiser — "no raiser, so it is raise-or-fold" — which held right up until
 * these charts began open-limping small pairs. It then asked "22 under the
 * gun?" while offering only fold and raise, and marked either answer wrong. A
 * question whose correct answer is not on screen is the worst failure a drill
 * can have: it teaches that the right play does not exist. So every action the
 * node actually prescribes is still offered, read off the node, never guessed.
 *
 * *Buttons that answer the question.* Reading the node fixed that and created a
 * subtler problem. Only two nodes in this set call — under the gun, which
 * open-limps small pairs, and the button behind limpers — so a visible call
 * button announced which seat you were in before you had looked at the table.
 * Since the position labels came off, that was the largest remaining tell on
 * the screen. A constant set of buttons carries no information, which is the
 * point: the table should be the only thing the spot can be read from.
 */
export function offeredActions(node: ChartNode): ActionKind[] {
  const seen = new Set<ActionKind>(ALWAYS_OFFERED);
  for (const strategy of Object.values(node.strategies)) {
    for (const action of activeActions(strategy)) seen.add(action);
  }
  return ACTIONS.filter((action) => seen.has(action));
}

/** True when more than one action is genuinely taken. */
export function isMixed(strategy: Strategy): boolean {
  return activeActions(strategy).length > 1;
}

/**
 * The single most-taken action.
 *
 * Ties break toward the more aggressive action, matching how these charts are
 * read in practice: at a genuine coin-flip between calling and raising, the
 * raise is the one that needs deliberate practice, because passivity is the
 * default a beginner falls into unprompted.
 */
export function bestAction(strategy: Strategy): ActionKind {
  let best: ActionKind = "fold";
  let bestFreq = -1;
  for (const action of ACTIONS) {
    const freq = freqOf(strategy, action);
    if (freq >= bestFreq) {
      best = action;
      bestFreq = freq;
    }
  }
  return best;
}

/** Highest EV across actions, or undefined when the source carries no EV. */
export function bestEv(strategy: Strategy): number | undefined {
  let best: number | undefined;
  for (const action of ACTIONS) {
    const ev = strategy[action]?.ev;
    if (ev === undefined) continue;
    if (best === undefined || ev > best) best = ev;
  }
  return best;
}

/**
 * Validate that a strategy's frequencies form a probability distribution.
 *
 * Authored charts are written by a human and this is exactly the sort of error
 * a human makes. Called from chart tests so a malformed chart fails at build
 * time rather than teaching the wrong thing at review time.
 */
export function strategyError(strategy: Strategy): string | null {
  const actions = ACTIONS.filter((a) => strategy[a] !== undefined);
  if (actions.length === 0) return "strategy is empty";

  let total = 0;
  for (const action of actions) {
    const freq = strategy[action]!.freq;
    if (!Number.isFinite(freq) || freq < 0 || freq > 1) {
      return `frequency for "${action}" is ${freq}, expected 0..1`;
    }
    total += freq;
  }

  // A tolerance wide enough for hand-written thirds (0.33 + 0.33 + 0.34) and
  // for solver rounding, narrow enough to catch a genuinely missing action.
  if (Math.abs(total - 1) > 0.005) {
    return `frequencies sum to ${total.toFixed(4)}, expected 1`;
  }
  return null;
}
