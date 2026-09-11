import type { Card } from "../poker/cards";
import type { PlayerType } from "../poker/rules";

export type CbetSize = "check" | "50-55" | "60" | "75" | "100" | "100+";
export type ContinueGroup = "top-pair" | "any-pair" | "draw" | "two-pair-plus";
export type HelpfulTurn = "improve" | "range-card" | "safe-blank";
export type StopPlan = "check-fold" | "one-and-done" | "two-streets" | "value-safe" | "value-now";

export const CONTINUE_LABEL: Record<ContinueGroup, string> = {
  "top-pair": "Top pair",
  "any-pair": "Any pair",
  draw: "Draw",
  "two-pair-plus": "Two pair+",
};

export const TURN_LABEL: Record<HelpfulTurn, string> = {
  improve: "Improves you",
  "range-card": "Hits your range",
  "safe-blank": "Safe blank",
};

export const STOP_LABEL: Record<StopPlan, string> = {
  "check-fold": "Check; fold a normal bet",
  "one-and-done": "Bet once; stop when called",
  "two-streets": "Check now; use two streets later",
  "value-safe": "Keep value betting safe turns",
  "value-now": "Build the pot now",
};

export const SIZE_LABEL: Record<CbetSize, string> = {
  check: "Check",
  "50-55": "50-55% pot",
  "60": "60% pot",
  "75": "75% pot",
  "100": "100% pot",
  "100+": "100%+ pot",
};

export interface FlopPlanSpot {
  id: string;
  hero: readonly [Card, Card];
  board: readonly [Card, Card, Card];
  position: "IP" | "OOP";
  villain: PlayerType;
  context: string;
  /** The groups expected to continue, or have the board when we check. */
  continues: readonly ContinueGroup[];
  /** What makes the next street worth investing in. */
  helpfulTurns: readonly HelpfulTurn[];
  stop: StopPlan;
  size: CbetSize;
  explanation: string;
}

/**
 * Curated examples, not a fabricated solver tree. Each one teaches a named
 * source rule from CTM pp. 130-150: plan before investing, use position and
 * perceived ranges, then use exploitative microstakes sizing.
 */
export const CTM_FLOP_SPOTS: readonly FlopPlanSpot[] = [
  {
    id: "dry-ace-high-air",
    hero: [{ rank: "Q", suit: "s" }, { rank: "J", suit: "d" }],
    board: [{ rank: "A", suit: "h" }, { rank: "7", suit: "c" }, { rank: "2", suit: "d" }],
    position: "IP",
    villain: "nit",
    context: "Raised pot. Dry A-high board. You missed.",
    continues: ["top-pair"],
    helpfulTurns: ["improve", "range-card"],
    stop: "one-and-done",
    size: "50-55",
    explanation: "Axx with two low rags is scary for the caller and favours your perceived range. Bet small when you miss; if the nit calls, give that strength credit instead of firing blindly.",
  },
  {
    id: "wet-board-oop-fish",
    hero: [{ rank: "A", suit: "s" }, { rank: "K", suit: "d" }],
    board: [{ rank: "9", suit: "h" }, { rank: "8", suit: "h" }, { rank: "7", suit: "c" }],
    position: "OOP",
    villain: "fish",
    context: "Raised pot. Wet middle board. You have two overcards only.",
    continues: ["any-pair", "draw", "two-pair-plus"],
    helpfulTurns: ["improve", "range-card"],
    stop: "check-fold",
    size: "check",
    explanation: "This board hits the caller's range. Out of position against a fish, air with little equity is a check-fold, not a hopeful c-bet. If checked back, improve or a strong range card can reopen the turn.",
  },
  {
    id: "wet-board-ip-air",
    hero: [{ rank: "A", suit: "s" }, { rank: "K", suit: "d" }],
    board: [{ rank: "9", suit: "h" }, { rank: "7", suit: "d" }, { rank: "6", suit: "c" }],
    position: "IP",
    villain: "tag",
    context: "Raised pot. Wet middle board. You missed, but have position.",
    continues: ["any-pair", "draw", "two-pair-plus"],
    helpfulTurns: ["improve", "range-card"],
    stop: "one-and-done",
    size: "60",
    explanation: "The same wet board is playable in position. Use the ordinary 60% pressure size, then stop when called unless a turn improves you or credibly changes the range story.",
  },
  {
    id: "threebet-pot-miss",
    hero: [{ rank: "Q", suit: "s" }, { rank: "J", suit: "s" }],
    board: [{ rank: "K", suit: "h" }, { rank: "7", suit: "c" }, { rank: "2", suit: "d" }],
    position: "IP",
    villain: "tag",
    context: "Three-bet pot. Dry K-high board. You missed.",
    continues: ["top-pair"],
    helpfulTurns: ["improve", "range-card"],
    stop: "one-and-done",
    size: "50-55",
    explanation: "In a three-bet pot, the lower stack-to-pot ratio makes a small 50-55% bet enough when you miss. Bigger usually does not buy more folds.",
  },
  {
    id: "sticky-reg-value",
    hero: [{ rank: "A", suit: "s" }, { rank: "K", suit: "d" }],
    board: [{ rank: "A", suit: "h" }, { rank: "T", suit: "c" }, { rank: "4", suit: "d" }],
    position: "OOP",
    villain: "nit",
    context: "Raised pot. Sticky regular. You have top pair, top kicker.",
    continues: ["top-pair", "any-pair"],
    helpfulTurns: ["safe-blank"],
    stop: "value-safe",
    size: "75",
    explanation: "A sticky regular that folds to c-bets 60% or less pays more with a good hand. Use 75% with value, then keep betting safe turns rather than treating top pair as a bluff.",
  },
  {
    id: "fish-value",
    hero: [{ rank: "A", suit: "s" }, { rank: "K", suit: "d" }],
    board: [{ rank: "A", suit: "h" }, { rank: "8", suit: "c" }, { rank: "5", suit: "d" }],
    position: "IP",
    villain: "fish",
    context: "Raised pot. Fish. You have top pair, top kicker.",
    continues: ["top-pair", "any-pair", "draw"],
    helpfulTurns: ["safe-blank"],
    stop: "value-safe",
    size: "100",
    explanation: "Fish and loose-passive players call with any piece. With TPTK or better, charge them now: full pot is the default value size regardless of position.",
  },
  {
    id: "bingo-board-overbet",
    hero: [{ rank: "A", suit: "s" }, { rank: "A", suit: "d" }],
    board: [{ rank: "9", suit: "h" }, { rank: "8", suit: "h" }, { rank: "7", suit: "c" }],
    position: "IP",
    villain: "fish",
    context: "Raised pot. Fish. Coordinated bingo board. You have an overpair.",
    continues: ["any-pair", "draw", "two-pair-plus"],
    helpfulTurns: ["safe-blank"],
    stop: "value-now",
    size: "100+",
    explanation: "Against a fish that will not fold a pair or draw on a coordinated board, an overbet can put more money in before a scare card kills the action. This is an exploit, not a default bluff size.",
  },
  {
    id: "delayed-cbet",
    hero: [{ rank: "A", suit: "s" }, { rank: "J", suit: "d" }],
    board: [{ rank: "J", suit: "h" }, { rank: "8", suit: "c" }, { rank: "4", suit: "d" }],
    position: "OOP",
    villain: "maniac",
    context: "Raised pot. Active opponent. You have a medium-strength top pair.",
    continues: ["top-pair", "any-pair", "draw"],
    helpfulTurns: ["safe-blank"],
    stop: "two-streets",
    size: "check",
    explanation: "A medium hand that cannot stand a raise can check against an active opponent. This is not giving up: call the flop where appropriate, then use the turn and possibly river as a two-street value plan.",
  },
];

export function gradeExact<T>(selected: readonly T[], expected: readonly T[]): boolean {
  if (selected.length !== expected.length) return false;
  const values = new Set(selected);
  return expected.every((value) => values.has(value));
}
