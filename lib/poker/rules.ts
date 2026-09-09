/**
 * Strategy as conditional rules, rather than as a hand-authored grid.
 *
 * The opening charts are a lookup: a seat and a hand give an action, and the
 * only way to add a spot is to write out 169 more answers. That is the right
 * shape for opening ranges, which really are arbitrary lists. It is the wrong
 * shape for everything that comes after.
 *
 * Facing a raise in 6-max is fifteen seat pairs. Facing a 3-bet is fifteen
 * more, facing a 4-bet fifteen more. Authored as grids that is forty-five
 * charts to write, check and memorise — and it would misrepresent the source,
 * because *the book does not have forty-five answers*. It has about six
 * sentences: fold by default, call to set-mine when the stacks justify it,
 * 3-bet the top of your range, call the tier below it, fold to a 4-bet without
 * aces or kings. Six rules covering forty-five spots is the entire reason this
 * strategy can be played without a chart open.
 *
 * So rules are the source and nodes are *generated* from them. Everything
 * downstream — the drill, the 13x13 grid, the grader, the leak engine, the
 * scheduler — keeps consuming `ChartNode` and never learns that some nodes were
 * computed rather than typed out.
 *
 * **A rule that needs a read is not a rule this can apply.** The playbook's
 * conditional exceptions — light 3-bets against someone who folds too much, a
 * flat call against a nit's early open — are real strategy and are authored
 * here, but they stay out of generated nodes unless the caller supplies the
 * read. Grading someone against a condition the app cannot verify is the
 * leak-engine-inventing-leaks failure this project is built to avoid.
 */

import {
  type ActionKind,
  type ChartNode,
  type NodeKey,
  type Position,
  type Scenario,
  type Strategy,
  isInPosition,
} from "./charts";
import { type Hand, allHands } from "./hands";

/**
 * What a villain looks like, when we know.
 *
 * The five types the book recognises. Absent means no read, which is the
 * normal case and the one the default ranges are built for.
 */
export type PlayerType = "nit" | "tag" | "slp" | "fish" | "maniac";

/** Everything a rule is allowed to test. */
export interface RuleSpot {
  scenario: Scenario;
  /** The hero's seat. */
  position: Position;
  /** Whoever created the spot — the opener, the 3-bettor, the 4-bettor. */
  villain?: Position;
  hand: Hand;
  /** Effective stack in big blinds. Several rules turn on this. */
  stackBb: number;
  /**
   * Hero acts after villain on later streets.
   *
   * Part of the spot rather than always derived, because a synthetic drill may
   * want to pose the question either way round.
   */
  inPosition: boolean;
  /** The villain's type, when a read exists. */
  villainType?: PlayerType;
  /** A recreational player has already put money in. */
  fishInPot?: boolean;
  /** Folds to 3-bets or cbets more than 70% of the time, over 100+ hands. */
  foldsTooMuch?: boolean;
}

/**
 * One sentence of the playbook, made executable.
 *
 * `cite` is not decoration. A verdict that says "fold" teaches nothing; one
 * that says "fold — facing a raise your default is 3-bet or fold" sends you to
 * the paragraph that explains it, which is the whole point of grading against a
 * book rather than against a solver.
 */
export interface Rule {
  /** Stable id. Used as a leak name and, later, as a scheduler card key. */
  id: string;
  scenario: Scenario;
  /** Where this comes from. */
  cite: string;
  /** What the rule says, in one line, shown to the user. */
  summary: string;
  /**
   * True when this rule governs the spot.
   *
   * Rules are consulted in order and the first match wins, so a condition only
   * has to distinguish itself from the rules *after* it. That is what lets the
   * default sit at the bottom as an unconditional fold and stay readable.
   */
  when(spot: RuleSpot): boolean;
  /** What to do when it matches. */
  then: ActionKind;
  /**
   * True when the rule leans on a read.
   *
   * Excluded from generated nodes unless the caller opts in, because the spot a
   * node describes has no opponent attached to it.
   */
  needsRead?: boolean;
}

export interface Ruling {
  action: ActionKind;
  rule: Rule;
}

/** The action every spot falls back to when no rule claims it. */
export const DEFAULT_ACTION: ActionKind = "fold";

export interface DecideOptions {
  /**
   * Let rules that depend on a read participate.
   *
   * Off by default. On only when the spot genuinely carries the read the rule
   * tests — a drill that puts a HUD badge on the table, or an analyser with
   * enough hands on that opponent.
   */
  useReads?: boolean;
}

/**
 * The first rule that claims this spot.
 *
 * Null means no rule matched, which is not an error: it is how a ruleset says
 * "the default applies". Callers wanting an action rather than a rule should
 * use `actionFor`.
 */
export function decide(
  rules: readonly Rule[],
  spot: RuleSpot,
  options: DecideOptions = {},
): Ruling | null {
  for (const rule of rules) {
    if (rule.scenario !== spot.scenario) continue;
    if (rule.needsRead && !options.useReads) continue;
    if (!rule.when(spot)) continue;
    return { action: rule.then, rule };
  }
  return null;
}

/** What to do, with the default filled in. */
export function actionFor(
  rules: readonly Rule[],
  spot: RuleSpot,
  options: DecideOptions = {},
): ActionKind {
  return decide(rules, spot, options)?.action ?? DEFAULT_ACTION;
}

/** The spot a node describes, for one hand. */
function spotAt(key: NodeKey, hand: Hand): RuleSpot {
  return {
    scenario: key.scenario,
    position: key.position,
    villain: key.villain,
    hand,
    stackBb: key.stackBb,
    // With nobody to be out of position against, position is moot; true is the
    // reading that never suppresses a rule.
    inPosition:
      key.villain === undefined ? true : isInPosition(key.position, key.villain),
  };
}

/**
 * Build the node a ruleset prescribes for one situation.
 *
 * Every hand is asked separately, which is how a handful of rules becomes a
 * full 169-hand strategy without anyone typing one out. Hands the rules do not
 * claim are simply absent — the same sparse convention the authored charts use,
 * where an unlisted hand folds.
 */
export function nodeFromRules(
  rules: readonly Rule[],
  key: NodeKey,
  options: DecideOptions = {},
): ChartNode {
  const strategies: Record<Hand, Strategy> = {};

  for (const hand of allHands()) {
    const ruling = decide(rules, spotAt(key, hand), options);
    if (!ruling || ruling.action === "fold") continue;
    strategies[hand] = { [ruling.action]: { freq: 1 } };
  }

  return { key, strategies };
}

/**
 * Which rule produced a hand's action at a node.
 *
 * The grader needs the action; a person who got it wrong needs the sentence.
 * Kept separate from `nodeFromRules` so the node stays a plain `ChartNode` and
 * nothing downstream has to know rules exist.
 */
export function ruleFor(
  rules: readonly Rule[],
  key: NodeKey,
  hand: Hand,
  options: DecideOptions = {},
): Rule | null {
  return decide(rules, spotAt(key, hand), options)?.rule ?? null;
}
