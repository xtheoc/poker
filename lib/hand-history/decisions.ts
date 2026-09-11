/**
 * Turning a played hand into the decisions the hero actually faced.
 *
 * This is the join between "what happened" and "what should have happened". A
 * parsed hand is a transcript; the leak engine needs a list of moments where a
 * choice was made, each with enough context to be judged and, where possible,
 * matched to a chart node.
 *
 * The load-bearing rule is the one that governs the whole platform: **a node is
 * attached only when the spot is genuinely the one the chart describes.** A
 * hand that reached the hero through two limpers is not the "folded to you in
 * the cutoff" node, and pretending otherwise would grade a correct play as an
 * error. Unmatched decisions still come back — they are real decisions, and
 * postflop analysis will want them — they simply carry no node, and the
 * deterministic pass skips them.
 */

import type { ActionKind, NodeKey, Position } from "../poker/charts";
import { type Hand, handClassFromCards } from "../poker/hands";
import { streetTotalAfter } from "./money";
import type { Action, ParsedHand, Street } from "./types";

export interface HeroDecision {
  street: Street;
  /** Pot before the hero acts, in big blinds. */
  potBb: number;
  /** Price of continuing, in big blinds. Zero when checking is free. */
  toCallBb: number;
  /** The hero's remaining stack when the decision was made, in big blinds. */
  stackBb: number;
  /** The hero's hand as one of the 169 classes. */
  hand: Hand;
  /** What the hero actually did. */
  actual: ActionKind;
  /** Total wagered by the action, in big blinds, where it moved money. */
  actualBb?: number;
  /**
   * The chart node this decision sits at, when it maps cleanly to one.
   *
   * Absent for limped pots, multiway spots, and anything past a single raise —
   * situations the beginner chart set does not cover and must not pretend to.
   */
  node?: NodeKey;
}

/**
 * Limpers that make a pot worth limping into rather than raising.
 *
 * The book's number — "a lot of limpers in front of you (3 or more)". Six
 * handed, only the button can ever face this: it is the last seat with three
 * players in front of it, and the cutoff has two. So the rule fires on exactly
 * one seat here, which is a fact about six-max rather than a simplification.
 */
const LIMP_CROWD = 3;

/** Actions that represent a voluntary decision rather than a forced post. */
const DECISIONS: ReadonlySet<Action["type"]> = new Set([
  "fold",
  "check",
  "call",
  "bet",
  "raise",
]);

/**
 * How a hand-history action maps onto the three actions a chart speaks in.
 *
 * A check becomes "fold" because both are the decision to put no money in.
 * That reads oddly and is right: preflop the chart's question is only ever
 * whether to commit chips, and the big blind checking its option has declined
 * to raise exactly as a fold declines to call.
 */
const ACTION_KIND: Partial<Record<Action["type"], ActionKind>> = {
  fold: "fold",
  check: "fold",
  call: "call",
  bet: "raise",
  raise: "raise",
};

export interface ExtractOptions {
  /** Which betting tree the chart set describes, e.g. "6max-2.5x". */
  treeId: string;
  /** Stack depth the chart set is solved at, in big blinds. */
  chartStackBb?: number;
}

/**
 * Every decision the hero faced, in order.
 *
 * Returns an empty list when the hero's cards are unknown — a hand with no
 * "Dealt to" line is still worth storing, but there is nothing to grade.
 */
export function heroDecisions(
  parsed: ParsedHand,
  options: ExtractOptions,
): HeroDecision[] {
  if (!parsed.hero) return [];

  const hand = handClassFromCards(parsed.hero.cards);
  if (!hand) return [];

  const heroName = parsed.hero.player;
  const bb = parsed.bigBlind;
  if (!bb || bb <= 0) return [];

  const decisions: HeroDecision[] = [];
  let stack = parsed.seats.find((s) => s.player === heroName)?.stack ?? 0;
  /** Money settled from earlier streets. */
  let settledPot = 0;
  let heroPreflopDecisions = 0;

  for (const street of parsed.streets) {
    // Per-street contributions, which is what a price to call is computed from.
    const wagered = new Map<string, number>();

    for (const action of street.actions) {
      const isHero = action.player === heroName;

      if (isHero && DECISIONS.has(action.type)) {
        const highest = Math.max(0, ...wagered.values());
        const heroIn = wagered.get(heroName) ?? 0;
        const kind = ACTION_KIND[action.type];

        if (kind) {
          decisions.push({
            street: street.street,
            potBb: round((settledPot + sum(wagered.values())) / bb),
            toCallBb: round(Math.max(0, highest - heroIn) / bb),
            stackBb: round(stack / bb),
            hand,
            actual: kind,
            actualBb:
              action.amount !== undefined ? round(action.amount / bb) : undefined,
            node:
              street.street === "preflop"
                ? preflopNode(
                    parsed,
                    heroName,
                    street.actions,
                    action,
                    heroPreflopDecisions,
                    options,
                  )
                : undefined,
          });
        }
        if (street.street === "preflop") heroPreflopDecisions++;
      }

      if (action.amount === undefined) continue;

      // PokerStars writes raises as street totals and calls as increments; that
      // rule lives in `money.ts` because getting it wrong silently corrupts
      // every pot, and it must be written down exactly once.
      const before = wagered.get(action.player) ?? 0;
      const total = streetTotalAfter(before, action);
      wagered.set(action.player, total);
      // A no-op for collections, which change nothing about what is wagered,
      // and a refund for an uncalled bet, which lowers the total.
      if (isHero) stack -= total - before;
    }

    settledPot += sum(wagered.values());
  }

  return decisions;
}

/**
 * The chart node for the hero's first preflop decision, when there is one.
 *
 * The first action may be an opening decision, a limped pot, or a response to
 * one raise. A later hero action can be the decision after a three-bet or a
 * four-bet. Anything with a cold caller, squeeze, or a non-standard raising
 * sequence remains unmatched: it is better to leave a real but unsupported
 * spot ungraded than call a different situation the same node.
 */
function preflopNode(
  parsed: ParsedHand,
  heroName: string,
  actions: readonly Action[],
  heroAction: Action,
  heroPreflopDecisions: number,
  options: ExtractOptions,
): NodeKey | undefined {
  const position = parsed.seats.find((s) => s.player === heroName)?.position;
  if (!position) return undefined;

  const preceding: Action[] = [];
  let raises = 0;
  let coldCalls = 0;
  let lastRaiser: Position | undefined;

  for (const action of actions) {
    if (action === heroAction) break;
    preceding.push(action);
    if (action.type === "raise") {
      raises++;
      lastRaiser =
        parsed.seats.find((s) => s.player === action.player)?.position ?? undefined;
    } else if (action.type === "call") {
      coldCalls++;
    }
  }

  // A cold-caller behind a raise puts the hero in a spot no chart here
  // describes. Limpers into an unraised pot are handled below — they used to be
  // rejected here too, which is wrong for the chart set this now grades against.
  if (coldCalls > 0 && raises > 0) return undefined;

  const base = {
    stackBb: options.chartStackBb ?? 100,
    treeId: options.treeId,
  };

  // A later hero decision only has a chart when the earlier preflop sequence
  // is clean and exactly matches the book's response trees.
  if (heroPreflopDecisions > 0) {
    return responseNode(parsed, heroName, preceding, coldCalls, base);
  }

  if (raises === 0) {
    // Folded round to the big blind is not a decision — everyone passed, the
    // blind wins, and there is nothing to grade. *Limped* to the big blind is,
    // and it is the one spot where "raise or take the free flop" is a real
    // question the opening ranges answer.
    if (position === "BB" && coldCalls === 0) return undefined;

    // Behind a crowd, the button plays a different range — part of it limps
    // rather than raises. The threshold is the book's: "a lot of limpers in
    // front of you (3 or more)".
    if (position === "BTN" && coldCalls >= LIMP_CROWD) {
      return { scenario: "vs-limp", position, ...base };
    }

    // Limped pots count. The opening ranges are transcribed from a book whose
    // own scope note is that they apply "when you are first to enter the pot or
    // there have been limpers", and which says elsewhere that raising over
    // limpers with them "is completely fine".
    //
    // This was previously rejected, on the reasoning that a hand reaching you
    // through two limpers is not the folded-to-you spot. That is a real
    // argument, and it belongs to a different chart set than the one loaded. As
    // written it silently left a large share of micro-stakes hands ungraded —
    // limped pots are common there — so the denominator shrank and nothing said
    // which hands had left it.
    return { scenario: "rfi", position, ...base };
  }

  if (raises === 1 && lastRaiser) {
    return { scenario: "vs-rfi", position, villain: lastRaiser, ...base };
  }

  return undefined;
}

function responseNode(
  parsed: ParsedHand,
  heroName: string,
  preceding: readonly Action[],
  coldCalls: number,
  base: Pick<NodeKey, "stackBb" | "treeId">,
): NodeKey | undefined {
  if (coldCalls > 0) return undefined;

  const raises = preceding.filter((action) => action.type === "raise");
  const heroRaises = raises.filter((action) => action.player === heroName);
  const position = parsed.seats.find((seat) => seat.player === heroName)?.position;
  if (!position || heroRaises.length !== 1) return undefined;

  // Hero opened, one later player three-bet, and the action came back cleanly.
  if (
    raises.length === 2 &&
    raises[0]?.player === heroName &&
    raises[1]?.player !== heroName
  ) {
    const villain = positionOf(parsed, raises[1]!.player);
    return villain ? { scenario: "vs-3bet", position, villain, ...base } : undefined;
  }

  // Someone opened, hero three-bet, that original opener four-bet. A cold
  // four-bet is intentionally excluded because the playbook names it as a
  // separate exception rather than a baseline range.
  if (
    raises.length === 3 &&
    raises[1]?.player === heroName &&
    raises[0]?.player === raises[2]?.player
  ) {
    const villain = positionOf(parsed, raises[2]!.player);
    return villain ? { scenario: "vs-4bet", position, villain, ...base } : undefined;
  }

  return undefined;
}

function positionOf(parsed: ParsedHand, player: string): Position | undefined {
  return parsed.seats.find((seat) => seat.player === player)?.position ?? undefined;
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** Big blinds to two decimals — enough precision, and comparable across hands. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
