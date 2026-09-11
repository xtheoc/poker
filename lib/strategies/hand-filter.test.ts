import { describe, expect, it } from "vitest";
import { matchesHandFilter, type StrategyHandFacts } from "./hand-filter";

const NL2_6MAX: StrategyHandFacts = {
  bigBlind: 0.02,
  currency: "USD",
  gameType: "cash",
  maxSeats: 6,
  fastFold: false,
  playedAt: new Date("2026-09-10T12:00:00Z"),
};

describe("strategy hand filters", () => {
  it("matches a complete NL2 six-max filter", () => {
    expect(
      matchesHandFilter(NL2_6MAX, {
        gameTypes: ["cash"],
        maximumBigBlind: 0.02,
        seatCounts: [6],
        fastFold: false,
        currencies: ["USD"],
      }),
    ).toBe(true);
  });

  it("does not silently classify an incompatible hand", () => {
    expect(matchesHandFilter({ ...NL2_6MAX, maxSeats: 9 }, { seatCounts: [6] })).toBe(false);
    expect(matchesHandFilter({ ...NL2_6MAX, fastFold: true }, { fastFold: false })).toBe(false);
    expect(matchesHandFilter({ ...NL2_6MAX, bigBlind: 0.05 }, { maximumBigBlind: 0.02 })).toBe(false);
  });

  it("makes date windows inclusive at the start and exclusive at the end", () => {
    const filter = {
      from: new Date("2026-09-10T12:00:00Z"),
      until: new Date("2026-09-10T13:00:00Z"),
    };
    expect(matchesHandFilter(NL2_6MAX, filter)).toBe(true);
    expect(matchesHandFilter({ ...NL2_6MAX, playedAt: filter.until }, filter)).toBe(false);
  });
});
