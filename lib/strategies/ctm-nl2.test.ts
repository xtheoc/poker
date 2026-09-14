import { describe, expect, it } from "vitest";
import { openSizeBb, strategyFor } from "../poker/charts";
import { CTM_NL2, CTM_NL2_CHART, CTM_NL2_LEARNING } from "./ctm-nl2";
import { matchesHandFilter } from "./hand-filter";
import { getLearningStrategy } from "./index";
import { validateLearningSystem } from "./learning";

describe("Crushing the Microstakes NL2 strategy", () => {
  it("is registered as a learner-facing strategy", () => {
    expect(getLearningStrategy("ctm-nl2")).toBe(CTM_NL2);
  });

  it("has a source-backed, ordered end-to-end learning map", () => {
    validateLearningSystem(CTM_NL2_LEARNING);
    expect(CTM_NL2_LEARNING.lessons.map((lesson) => lesson.id)).toEqual([
      "read-the-table",
      "open-with-purpose",
      "size-the-pot",
      "face-an-open",
      "squeeze",
      "three-bet-tree",
      "four-bet-tree",
      "flop-plan",
      "turn-discipline",
      "river-extraction",
    ]);
    expect(CTM_NL2_LEARNING.lessons.every((lesson) => lesson.assets.length > 0)).toBe(true);
  });

  it("assigns only regular NL2 six-max cash hands", () => {
    const facts = {
      bigBlind: 0.02,
      currency: "USD",
      gameType: "cash" as const,
      maxSeats: 6,
      fastFold: false,
      playedAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(matchesHandFilter(facts, CTM_NL2_LEARNING.tracking.filter)).toBe(true);
    expect(matchesHandFilter({ ...facts, fastFold: true }, CTM_NL2_LEARNING.tracking.filter)).toBe(false);
    expect(matchesHandFilter({ ...facts, maxSeats: 9 }, CTM_NL2_LEARNING.tracking.filter)).toBe(false);
    expect(matchesHandFilter({ ...facts, bigBlind: 0.05 }, CTM_NL2_LEARNING.tracking.filter)).toBe(false);
  });

  it("owns the book's NL2 sizing tree and revised early-pair action", () => {
    expect(openSizeBb(CTM_NL2_CHART, "UTG")).toBe(4);
    expect(openSizeBb(CTM_NL2_CHART, "HJ")).toBe(4);
    expect(openSizeBb(CTM_NL2_CHART, "CO")).toBe(3);
    expect(openSizeBb(CTM_NL2_CHART, "BTN")).toBe(3);

    const utg = CTM_NL2_CHART.nodes.find(
      (node) => node.key.scenario === "rfi" && node.key.position === "UTG",
    );
    expect(utg).toBeDefined();
    expect(strategyFor(utg!, "22").raise?.freq).toBe(1);
    expect(strategyFor(utg!, "22").call).toBeUndefined();
  });
});
