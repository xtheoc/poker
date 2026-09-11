/**
 * Strategy hand filters.
 *
 * Hands are stored once. A strategy assignment is a versioned interpretation
 * of those canonical rows, which means changing a stake boundary next month
 * does not overwrite what the importer knew when it first sorted a hand.
 */

export interface StrategyHandFacts {
  bigBlind: number;
  currency: string | null;
  gameType: "cash" | "tournament";
  maxSeats: number | null;
  fastFold: boolean;
  playedAt: Date;
}

export interface HandFilter {
  gameTypes?: readonly StrategyHandFacts["gameType"][];
  minimumBigBlind?: number;
  maximumBigBlind?: number;
  seatCounts?: readonly number[];
  fastFold?: boolean;
  currencies?: readonly string[];
  from?: Date;
  until?: Date;
}

/** A missing constraint means "do not filter on this field", not "unknown". */
export function matchesHandFilter(facts: StrategyHandFacts, filter: HandFilter): boolean {
  if (filter.gameTypes && !filter.gameTypes.includes(facts.gameType)) return false;
  if (filter.minimumBigBlind !== undefined && facts.bigBlind < filter.minimumBigBlind) {
    return false;
  }
  if (filter.maximumBigBlind !== undefined && facts.bigBlind > filter.maximumBigBlind) {
    return false;
  }
  if (filter.seatCounts && (!facts.maxSeats || !filter.seatCounts.includes(facts.maxSeats))) {
    return false;
  }
  if (filter.fastFold !== undefined && facts.fastFold !== filter.fastFold) return false;
  if (filter.currencies && (!facts.currency || !filter.currencies.includes(facts.currency))) {
    return false;
  }
  if (filter.from && facts.playedAt < filter.from) return false;
  if (filter.until && facts.playedAt >= filter.until) return false;
  return true;
}
