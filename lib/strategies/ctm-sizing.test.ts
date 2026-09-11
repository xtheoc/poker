import { describe, expect, it } from "vitest";
import { ctmOpenSizeBb, dealCtmSizingSpot, scoreCtmSizing } from "./ctm-sizing";

describe("CTM NL2 sizing", () => {
  it("uses the 4bb early/middle and 3bb late baseline", () => {
    expect(ctmOpenSizeBb("UTG", 0)).toBe(4);
    expect(ctmOpenSizeBb("HJ", 0)).toBe(4);
    expect(ctmOpenSizeBb("CO", 0)).toBe(3);
    expect(ctmOpenSizeBb("BTN", 0)).toBe(3);
  });

  it("adds one blind per limper normally and two from the blinds", () => {
    expect(ctmOpenSizeBb("BTN", 2)).toBe(5);
    expect(ctmOpenSizeBb("SB", 2)).toBe(8);
    expect(ctmOpenSizeBb("BB", 3)).toBe(10);
    expect(ctmOpenSizeBb("BB", 1, true)).toBe(4);
  });

  it("deals a fully gradeable spot", () => {
    const spot = dealCtmSizingSpot(() => 0);
    expect(spot).toMatchObject({ position: "UTG", limpers: 0, expectedBb: 4 });
  });

  it("never reports more correct decisions than a run contains", () => {
    expect(scoreCtmSizing(16, 15)).toEqual({ correct: 15, score: 100 });
    expect(scoreCtmSizing(-2, 15)).toEqual({ correct: 0, score: 0 });
  });
});
