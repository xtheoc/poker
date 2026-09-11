import { describe, expect, it } from "vitest";
import type { Violation } from "../leaks";
import { strategyMistakeTargets } from "./mistake-drill";

function violation(overrides: Partial<Violation> = {}): Violation {
  return {
    handId: "hand-1",
    playedAt: new Date("2026-01-01T10:00:00Z"),
    hand: "AJo",
    nodeId: "ctm/100bb/vs-rfi/BTN-vs-CO",
    spot: "BTN vs CO",
    chosen: "call",
    expected: "raise",
    grade: "wrong",
    kind: "wrong-line",
    ...overrides,
  };
}

describe("strategyMistakeTargets", () => {
  it("keeps every misplayed hand while merging one decision shape", () => {
    const targets = strategyMistakeTargets([
      violation(),
      violation({ handId: "hand-2", hand: "AQo", playedAt: new Date("2026-01-03T10:00:00Z") }),
    ]);

    expect(targets).toEqual([
      expect.objectContaining({
        hands: ["AJo", "AQo"],
        instances: 2,
        lastSeenAt: new Date("2026-01-03T10:00:00Z"),
      }),
    ]);
  });

  it("puts the newest decision shape first", () => {
    const targets = strategyMistakeTargets([
      violation(),
      violation({
        handId: "hand-2",
        nodeId: "ctm/100bb/vs-3bet/CO-vs-BTN",
        spot: "CO vs BTN",
        playedAt: new Date("2026-01-04T10:00:00Z"),
      }),
    ]);

    expect(targets.map((target) => target.nodeId)).toEqual([
      "ctm/100bb/vs-3bet/CO-vs-BTN",
      "ctm/100bb/vs-rfi/BTN-vs-CO",
    ]);
  });
});
