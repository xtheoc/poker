import { describe, expect, it } from "vitest";
import { CTM_FLOP_SPOTS, gradeExact } from "./ctm-flop";

describe("CTM flop planning deck", () => {
  it("covers every authored c-bet size and the check line", () => {
    expect(new Set(CTM_FLOP_SPOTS.map((spot) => spot.size))).toEqual(
      new Set(["check", "50-55", "60", "75", "100", "100+"]),
    );
  });

  it("has a concrete plan for every spot", () => {
    for (const spot of CTM_FLOP_SPOTS) {
      expect(spot.continues.length).toBeGreaterThan(0);
      expect(spot.helpfulTurns.length).toBeGreaterThan(0);
      expect(spot.explanation.length).toBeGreaterThan(40);
    }
  });

  it("requires an exact multi-select answer", () => {
    expect(gradeExact(["draw", "any-pair"], ["any-pair", "draw"])).toBe(true);
    expect(gradeExact(["draw"], ["any-pair", "draw"])).toBe(false);
  });
});
