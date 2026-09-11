import type { Position } from "../poker/charts";

export interface CtmSizingSpot {
  position: Position;
  limpers: number;
  /** The small blind limped and the hero is deciding in the big blind. */
  smallBlindLimped?: boolean;
  expectedBb: number;
}

/**
 * Turn a completed sizing run into a valid mastery result.
 *
 * The count is clamped at the boundary of the run. A browser can deliver two
 * events unusually close together, but no fifteen-question run can ever have
 * sixteen correct decisions; keeping that invariant here also keeps the API
 * contract honest.
 */
export function scoreCtmSizing(correct: number, total: number): {
  correct: number;
  score: number;
} {
  const safeTotal = Math.max(1, Math.floor(total));
  const safeCorrect = Math.min(safeTotal, Math.max(0, Math.floor(correct)));
  return {
    correct: safeCorrect,
    score: Math.round((safeCorrect / safeTotal) * 100),
  };
}

const OPTIONS: ReadonlyArray<Omit<CtmSizingSpot, "expectedBb">> = [
  { position: "UTG", limpers: 0 },
  { position: "HJ", limpers: 0 },
  { position: "HJ", limpers: 1 },
  { position: "CO", limpers: 0 },
  { position: "CO", limpers: 1 },
  { position: "CO", limpers: 2 },
  { position: "BTN", limpers: 0 },
  { position: "BTN", limpers: 1 },
  { position: "BTN", limpers: 2 },
  { position: "BTN", limpers: 3 },
  { position: "SB", limpers: 0 },
  { position: "SB", limpers: 1 },
  { position: "SB", limpers: 2 },
  { position: "BB", limpers: 1, smallBlindLimped: true },
  { position: "BB", limpers: 2 },
  { position: "BB", limpers: 3 },
];

/** The source ladder, centralised so drills and later hand review cannot drift. */
export function ctmOpenSizeBb(
  position: Position,
  limpers: number,
  smallBlindLimped = false,
): number {
  if (smallBlindLimped && position === "BB") return 4;

  const base = position === "CO" || position === "BTN" ? 3 : 4;
  // A blind adds the regular limper adjustment and one extra blind per limper.
  const perLimper = position === "SB" || position === "BB" ? 2 : 1;
  return base + limpers * perLimper;
}

export function dealCtmSizingSpot(rng: () => number = Math.random): CtmSizingSpot {
  const option = OPTIONS[Math.floor(rng() * OPTIONS.length)] ?? OPTIONS[0];
  return {
    ...option,
    expectedBb: ctmOpenSizeBb(option.position, option.limpers, option.smallBlindLimped),
  };
}

export function dealCtmSizingSession(
  count: number,
  rng: () => number = Math.random,
): CtmSizingSpot[] {
  return Array.from({ length: count }, () => dealCtmSizingSpot(rng));
}

export function describeCtmSizingSpot(spot: CtmSizingSpot): string {
  if (spot.smallBlindLimped) return "Small blind limps to you";
  if (spot.limpers === 0) return "Folded to you";
  return `${spot.limpers} ${spot.limpers === 1 ? "limper" : "limpers"} before you`;
}
