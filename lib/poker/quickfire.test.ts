import { describe, expect, it } from "vitest";
import { activeActions, nodeId } from "./charts";
import { BEGINNER_6MAX } from "./charts/beginner-6max";
import { dealSession, dealSpot, describeSpot } from "./quickfire";

/** Deterministic generator, so a sampling test never flakes. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

describe("dealing a single spot", () => {
  it("returns a hand belonging to a real node in the set", () => {
    const spot = dealSpot(BEGINNER_6MAX, { rng: seeded(1) })!;
    expect(spot).not.toBeNull();
    expect(BEGINNER_6MAX.nodes).toContain(spot.node);
    expect(spot.itemKey).toBe(nodeId(spot.node.key));
  });

  it("carries a usable strategy for the dealt hand", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const spot = dealSpot(BEGINNER_6MAX, { rng: seeded(seed) })!;
      expect(activeActions(spot.strategy).length).toBeGreaterThan(0);
    }
  });

  it("rolls no die at a pure node", () => {
    // The whole beginner set is pure, so a die would imply a mix that is not
    // there — and teach a strategy the chart does not contain.
    for (let seed = 1; seed <= 30; seed++) {
      expect(dealSpot(BEGINNER_6MAX, { rng: seeded(seed) })!.roll).toBeUndefined();
    }
  });
});

describe("dealing a session", () => {
  it("deals the number of spots asked for", () => {
    expect(dealSession(BEGINNER_6MAX, 20, { rng: seeded(3) })).toHaveLength(20);
  });

  it("never shows the same spot twice in a row", () => {
    // Two cutoff opens back to back turns the second into a memory test rather
    // than a recognition test.
    const spots = dealSession(BEGINNER_6MAX, 40, { rng: seeded(7) });
    for (let i = 1; i < spots.length; i++) {
      expect(spots[i].itemKey).not.toBe(spots[i - 1].itemKey);
    }
  });

  it("spreads across every spot the set covers", () => {
    // Uniform node choice is the point: a session that kept returning to two
    // nodes would never surface the gaps.
    //
    // The deal count is a coupon-collector problem rather than a constant. It
    // was 40 when the set held 7 nodes, and 40 stopped being enough the moment
    // version 9 took it to 22. Scaled off the node count so that adding
    // scenarios never turns this into a flake.
    const deals = BEGINNER_6MAX.nodes.length * 12;
    const spots = dealSession(BEGINNER_6MAX, deals, { rng: seeded(11) });
    expect(new Set(spots.map((s) => s.itemKey)).size).toBe(
      BEGINNER_6MAX.nodes.length,
    );
  });

  it("mixes hands it plays with hands it folds", () => {
    // All folds teaches nothing; all playable teaches "always play".
    const spots = dealSession(BEGINNER_6MAX, 40, { rng: seeded(13) });
    const played = spots.filter((s) => {
      const actions = activeActions(s.strategy);
      return !(actions.length === 1 && actions[0] === "fold");
    });
    expect(played.length).toBeGreaterThan(5);
    expect(played.length).toBeLessThan(spots.length - 5);
  });

  it("copes with a chart set of one node rather than looping forever", () => {
    const single = { ...BEGINNER_6MAX, nodes: BEGINNER_6MAX.nodes.slice(0, 1) };
    expect(dealSession(single, 5, { rng: seeded(5) })).toHaveLength(5);
  });

  it("returns nothing for an empty chart set", () => {
    const empty = { ...BEGINNER_6MAX, nodes: [] };
    expect(dealSession(empty, 5, { rng: seeded(5) })).toEqual([]);
    expect(dealSpot(empty, { rng: seeded(5) })).toBeNull();
  });
});

describe("describing a spot", () => {
  it("says who opened, or that it is folded round", () => {
    const rfi = BEGINNER_6MAX.nodes.find((n) => !n.key.villain)!;
    expect(describeSpot(rfi)).toEqual({
      before: "Folded to you",
      seat: rfi.key.position,
    });

    // The shipped set has no facing-a-raise nodes since version 3, but the
    // wording still has to be right for the day one comes back — the type
    // allows a villain, so something must hold it to a sentence.
    const facing = {
      ...rfi,
      key: { ...rfi.key, scenario: "vs-rfi" as const, villain: "BTN" as const },
    };
    expect(describeSpot(facing).before).toBe("BTN opens");
  });
});
