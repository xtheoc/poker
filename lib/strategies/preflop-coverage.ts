/**
 * The observable preflop decision map for a strategy.
 *
 * A hand history is not enough to judge every poker decision. This module
 * makes that boundary explicit: every voluntary preflop action gets a family,
 * and each family is either gradeable from the current source, drill-only, or
 * unsupported. The last two are recorded rather than silently counted as
 * correct.
 */

import type { HeroDecision } from "../hand-history/decisions";
import type { Action, ParsedHand } from "../hand-history/types";
import type { Violation } from "../leaks";
import {
  type ChartSet,
  findNode,
  nodeId,
  strategyFor,
  type NodeKey,
  type Position,
} from "../poker/charts";
import { gradeAction, type ActionGrade } from "../poker/grading";

export type PreflopDecisionFamily =
  | "unopened"
  | "limped-pot"
  | "facing-open"
  | "facing-open-with-caller"
  | "squeeze"
  | "facing-3bet"
  | "facing-3bet-multiway"
  | "facing-4bet"
  | "limp-reraise"
  | "five-bet-plus"
  | "other";

export type CoverageStatus = "gradeable" | "drill-only" | "not-supported";

export interface DecisionFamilyDefinition {
  id: PreflopDecisionFamily;
  label: string;
  status: CoverageStatus;
  reason?: string;
}

/** The whole current preflop tree, including branches not judged yet. */
export const PREFLOP_DECISION_FAMILIES: readonly DecisionFamilyDefinition[] = [
  { id: "unopened", label: "Unopened pot", status: "gradeable" },
  { id: "limped-pot", label: "Limped pot", status: "gradeable" },
  { id: "facing-open", label: "Facing one open", status: "gradeable" },
  {
    id: "facing-open-with-caller",
    label: "Open plus caller",
    status: "drill-only",
    reason: "The correct exception depends on the caller and HUD read, which a hand history does not contain.",
  },
  {
    id: "squeeze",
    label: "Squeeze",
    status: "gradeable",
  },
  { id: "facing-3bet", label: "Facing a three-bet", status: "gradeable" },
  {
    id: "facing-3bet-multiway",
    label: "Three-bet with a caller", 
    status: "not-supported",
    reason: "The current three-bet rules apply only heads-up.",
  },
  { id: "facing-4bet", label: "Facing a four-bet", status: "gradeable" },
  {
    id: "limp-reraise",
    label: "Limp-reraise",
    status: "not-supported",
    reason: "The source does not define a fixed limp-reraise tree.",
  },
  {
    id: "five-bet-plus",
    label: "Five-bet or more",
    status: "not-supported",
    reason: "The current strategy stops at the normal four-bet response.",
  },
  {
    id: "other",
    label: "Other preflop sequence",
    status: "not-supported",
    reason: "This action sequence is outside the installed decision tree.",
  },
];

export interface StrategyPreflopDecision {
  index: number;
  family: PreflopDecisionFamily;
  status: CoverageStatus;
  reason?: string;
  nodeId?: string;
  hand: HeroDecision["hand"];
  actual: HeroDecision["actual"];
  expected?: HeroDecision["actual"];
  grade?: ActionGrade;
  effectiveStackBb?: number;
  violation?: Violation;
}

interface Context {
  family: PreflopDecisionFamily;
  position?: Position;
  villain?: Position;
  nonHeroCalls: number;
  callers?: readonly Position[];
}

const VOLUNTARY = new Set<Action["type"]>(["fold", "check", "call", "bet", "raise"]);

/** Evaluate every preflop action the hero actually took. */
export function reviewPreflopCoverage(
  hand: ParsedHand,
  decisions: readonly HeroDecision[],
  set: ChartSet,
): StrategyPreflopDecision[] {
  const hero = hand.hero?.player;
  const street = hand.streets.find((item) => item.street === "preflop");
  if (!hero || !street) return [];

  const heroActions = street.actions.filter(
    (action) => action.player === hero && VOLUNTARY.has(action.type),
  );
  const heroDecisions = decisions.filter((decision) => decision.street === "preflop");

  return heroDecisions.map((decision, index) => {
    const action = heroActions[index];
    if (!action) {
      return unsupported(index, decision, "other", "Could not align this action with its hand history.");
    }
    const context = contextFor(hand, hero, street.actions, action);
    return reviewOne(index, hand, decision, context, set);
  });
}

function reviewOne(
  index: number,
  hand: ParsedHand,
  decision: HeroDecision,
  context: Context,
  set: ChartSet,
): StrategyPreflopDecision {
  const definition = PREFLOP_DECISION_FAMILIES.find((item) => item.id === context.family)!;
  const effectiveStackBb = effectiveStack(hand, context.position, context.villain);

  // The 200bb kings exception depends on identifying a nit. No player type is
  // present in a PokerStars history, so grading it as the ordinary rule would
  // turn a valid exception into a false mistake.
  if (context.family === "facing-4bet" && (effectiveStackBb ?? 0) >= 200) {
    return {
      index,
      family: context.family,
      status: "drill-only",
      reason: "At this depth the kings exception depends on a verified nit read.",
      hand: decision.hand,
      actual: decision.actual,
      effectiveStackBb,
    };
  }
  if (definition.status !== "gradeable" || !context.position) {
    return {
      index,
      family: context.family,
      status: definition.status,
      reason: definition.reason,
      hand: decision.hand,
      actual: decision.actual,
      effectiveStackBb,
    };
  }

  const key = nodeFor(context, set, effectiveStackBb);
  const node = key ? findNode(set, nodeId(key)) : undefined;
  if (!node) {
    return unsupported(
      index,
      decision,
      context.family,
      "This stack or action tree does not have a verified rule yet.",
      effectiveStackBb,
    );
  }

  const graded = gradeAction(strategyFor(node, decision.hand), decision.actual, {
    potBb: decision.potBb,
  });
  const mistake = graded.grade !== "best" && graded.grade !== "correct";
  const currentNodeId = nodeId(key!);
  return {
    index,
    family: context.family,
    status: "gradeable",
    nodeId: currentNodeId,
    hand: decision.hand,
    actual: decision.actual,
    expected: graded.expected,
    grade: graded.grade,
    effectiveStackBb,
    violation: mistake
      ? {
          handId: hand.id,
          playedAt: hand.playedAt,
          hand: decision.hand,
          nodeId: currentNodeId,
          spot: context.villain
            ? `${context.position} vs ${context.villain}`
            : `${context.position} open`,
          chosen: graded.chosen,
          expected: graded.expected,
          grade: graded.grade,
          kind: classify(graded.chosen, graded.expected),
          evLossBb: graded.evLossBb,
        }
      : undefined,
  };
}

function nodeFor(
  context: Context,
  set: ChartSet,
  effectiveStackBb: number | undefined,
): NodeKey | undefined {
  if (!context.position) return undefined;
  if (context.family === "unopened" || context.family === "limped-pot") {
    return {
      scenario:
        context.family === "limped-pot" &&
        context.position === "BTN" &&
        context.nonHeroCalls >= 3
          ? "vs-limp"
          : "rfi",
      position: context.position,
      stackBb: set.stackBb,
      treeId: set.treeId,
    };
  }
  if (!context.villain) return undefined;
  const stackBb = effectiveStackBb !== undefined && effectiveStackBb <= 50 ? 50 : set.stackBb;
  const scenario =
    context.family === "facing-open"
      ? "vs-rfi"
      : context.family === "facing-3bet"
        ? "vs-3bet"
        : context.family === "facing-4bet"
          ? "vs-4bet"
          : context.family === "squeeze"
            ? "squeeze"
          : undefined;
  return scenario
    ? {
        scenario,
        position: context.position,
        villain: context.villain,
        callers: context.family === "squeeze" ? context.callers : undefined,
        stackBb,
        treeId: set.treeId,
      }
    : undefined;
}

function contextFor(
  hand: ParsedHand,
  hero: string,
  actions: readonly Action[],
  heroAction: Action,
): Context {
  const position = positionOf(hand, hero);
  const preceding: Action[] = [];
  for (const action of actions) {
    if (action === heroAction) break;
    preceding.push(action);
  }
  const raises = preceding.filter((action) => action.type === "raise");
  const callers = preceding
    .filter((action) => action.type === "call" && action.player !== hero)
    .map((action) => positionOf(hand, action.player))
    .filter((position): position is Position => position !== undefined);
  const nonHeroCalls = callers.length;
  const heroEarlier = preceding.filter(
    (action) => action.player === hero && VOLUNTARY.has(action.type),
  );
  const heroRaised = raises.some((action) => action.player === hero);
  const heroLimped = heroEarlier.some((action) => action.type === "call") && !heroRaised;
  const lastRaiser = raises.at(-1);

  if (raises.length === 0) {
    return { family: nonHeroCalls > 0 ? "limped-pot" : "unopened", position, nonHeroCalls };
  }
  if (raises.length === 1) {
    const villain = positionOf(hand, lastRaiser?.player);
    if (heroLimped) return { family: "limp-reraise", position, villain, nonHeroCalls };
    if (heroEarlier.length === 0) {
      if (nonHeroCalls > 0) {
        return {
          family: "squeeze",
          position,
          villain,
          nonHeroCalls,
          callers,
        };
      }
      return { family: "facing-open", position, villain, nonHeroCalls };
    }
    return { family: "other", position, villain, nonHeroCalls };
  }
  if (raises.length === 2) {
    const villain = positionOf(hand, lastRaiser?.player);
    if (raises[0]?.player === hero && raises[1]?.player !== hero) {
      return {
        family: nonHeroCalls > 0 ? "facing-3bet-multiway" : "facing-3bet",
        position,
        villain,
        nonHeroCalls,
      };
    }
    return { family: "other", position, villain, nonHeroCalls };
  }
  if (raises.length === 3) {
    const villain = positionOf(hand, raises[2]?.player);
    if (raises[1]?.player === hero && raises[0]?.player === raises[2]?.player) {
      return { family: "facing-4bet", position, villain, nonHeroCalls };
    }
    return { family: "other", position, villain, nonHeroCalls };
  }
  return {
    family: "five-bet-plus",
    position,
    villain: positionOf(hand, lastRaiser?.player),
    nonHeroCalls,
  };
}

function unsupported(
  index: number,
  decision: HeroDecision,
  family: PreflopDecisionFamily,
  reason: string,
  effectiveStackBb?: number,
): StrategyPreflopDecision {
  return {
    index,
    family,
    status: "not-supported",
    reason,
    hand: decision.hand,
    actual: decision.actual,
    effectiveStackBb,
  };
}

function effectiveStack(
  hand: ParsedHand,
  position: Position | undefined,
  villain: Position | undefined,
): number | undefined {
  if (!position || !villain || !hand.bigBlind) return undefined;
  const hero = hand.seats.find((seat) => seat.position === position)?.stack;
  const opponent = hand.seats.find((seat) => seat.position === villain)?.stack;
  if (hero === undefined || opponent === undefined) return undefined;
  return Math.round((Math.min(hero, opponent) / hand.bigBlind) * 100) / 100;
}

function positionOf(hand: ParsedHand, player: string | undefined): Position | undefined {
  return hand.seats.find((seat) => seat.player === player)?.position ?? undefined;
}

function classify(chosen: HeroDecision["actual"], expected: HeroDecision["actual"]): Violation["kind"] {
  if (expected === "fold") return "too-loose";
  if (chosen === "fold") return "too-tight";
  return "wrong-line";
}
