import { describe, expect, it } from "vitest";
import {
  contextualPreflopSpot,
  dealContextualPreflopSession,
  dealMixedContextualPreflopSession,
} from "./ctm-contextual";

describe("CTM contextual preflop dealer", () => {
  it("deals complete source-backed spots without immediate repeats", () => {
    let state = 17;
    const rng = () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
    const spots = dealContextualPreflopSession(40, undefined, rng);

    expect(spots).toHaveLength(40);
    expect(spots.every((spot) => spot.ruleSummary.length > 0)).toBe(true);
    expect(spots.every((spot, index) => index === 0 || spot.id !== spots[index - 1]?.id)).toBe(true);
  });

  it("uses table tags for the fish and nit exceptions", () => {
    const fish = contextualPreflopSpot("fish-speculative-ip", () => 0.2);
    const nit = contextualPreflopSpot("deep-nit-kings", () => 0.2);

    expect(fish.expected).toBe("call");
    expect(fish.playerTypes[fish.spot.villain!]).toBe("fish");
    expect(nit.expected).toBe("fold");
    expect(nit.playerTypes[nit.spot.villain!]).toBe("nit");
  });

  it("keeps squeeze callers on the visual table and rules out unsourced light squeezes", () => {
    const value = contextualPreflopSpot("squeeze-bb-jj-two-callers", () => 0.2);
    const fold = contextualPreflopSpot("squeeze-fold", () => 0.2);

    expect(value.expected).toBe("raise");
    expect(value.node.key.callers).toEqual(["HJ", "CO"]);
    expect(fold.expected).toBe("fold");
  });

  it("mixes one table-decision branch at a time before repeating a branch", () => {
    const spots = dealMixedContextualPreflopSession(12, () => 0.3);

    expect(spots).toHaveLength(12);
    for (let index = 0; index < spots.length; index += 4) {
      expect(new Set(spots.slice(index, index + 4).map((spot) => spot.family)).size).toBe(4);
    }
  });
});
