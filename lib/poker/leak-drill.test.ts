import { describe, expect, it } from "vitest";
import type { Leak } from "../leaks";
import { BEGINNER_6MAX } from "./charts/beginner-6max";
import { cycleLeakSpots, leakTargets } from "./leak-drill";

/** Deterministic randomness, so a failure is reproducible. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function leak(over: Partial<Leak> = {}): Leak {
  return {
    id: "leak",
    nodeId: "6max-2.5x/100bb/rfi/CO",
    spot: "CO open",
    kind: "too-loose",
    label: "Playing hands that should fold — CO open",
    instances: 5,
    sessions: 2,
    handIds: ["1"],
    hands: ["K3o"],
    lastSeenAt: new Date("2026-09-05T20:00:00Z"),
    confidence: "likely",
    drillable: true,
    score: 5,
    ...over,
  };
}

describe("choosing which leaks to drill", () => {
  it("refuses to drill a leak that is still only being watched", () => {
    const targets = leakTargets([
      leak({ id: "a", confidence: "watching", drillable: false }),
      leak({ id: "b" }),
    ]);

    // Drilling a pattern that might be noise builds a habit against something
    // that never happens, which is worse than not drilling at all.
    expect(targets).toHaveLength(1);
    expect(targets[0].nodeId).toBe("6max-2.5x/100bb/rfi/CO");
  });

  it("puts the most recent mistake first", () => {
    const targets = leakTargets([
      leak({
        id: "old",
        nodeId: "6max-2.5x/100bb/rfi/BTN",
        score: 99,
        lastSeenAt: new Date("2026-08-01T20:00:00Z"),
      }),
      leak({
        id: "fresh",
        nodeId: "6max-2.5x/100bb/rfi/CO",
        score: 1,
        lastSeenAt: new Date("2026-09-05T20:00:00Z"),
      }),
    ]);

    // Recency beats cost here on purpose: a mistake made last night is still
    // attached to the memory of the hand, which is when correcting it lands.
    expect(targets.map((t) => t.nodeId)).toEqual([
      "6max-2.5x/100bb/rfi/CO",
      "6max-2.5x/100bb/rfi/BTN",
    ]);
  });

  it("breaks a tie on the same day by cost", () => {
    const sameNight = new Date("2026-09-05T20:00:00Z");
    const targets = leakTargets([
      leak({
        id: "cheap",
        nodeId: "6max-2.5x/100bb/rfi/BTN",
        score: 1,
        lastSeenAt: sameNight,
      }),
      leak({
        id: "dear",
        nodeId: "6max-2.5x/100bb/rfi/CO",
        score: 9,
        lastSeenAt: sameNight,
      }),
    ]);

    expect(targets[0].nodeId).toBe("6max-2.5x/100bb/rfi/CO");
  });

  it("drops a leak whose node the chart set no longer has", () => {
    const spots = cycleLeakSpots(
      BEGINNER_6MAX,
      leakTargets([leak({ nodeId: "6max-2.5x/100bb/squeeze/BB" })]),
      5,
      { rng: seeded(1) },
    );

    expect(spots).toEqual([]);
  });
});

describe("dealing spots from leaks", () => {
  const targets = leakTargets([
    leak({ id: "a", nodeId: "6max-2.5x/100bb/rfi/CO", hands: ["K3o"] }),
    leak({
      id: "b",
      nodeId: "6max-2.5x/100bb/rfi/BTN",
      spot: "BTN open",
      hands: ["J4o"],
    }),
  ]);

  it("only ever deals spots from the leaking nodes", () => {
    const spots = cycleLeakSpots(BEGINNER_6MAX, targets, 5, { rng: seeded(7) });

    expect(spots).toHaveLength(5);
    for (const spot of spots) {
      expect(["6max-2.5x/100bb/rfi/CO", "6max-2.5x/100bb/rfi/BTN"]).toContain(
        spot.itemKey,
      );
    }
  });

  it("gives every leak an even share rather than sampling at random", () => {
    // The whole reason this is a rotation: a weighted draw can show one spot
    // four times in six and skip another entirely, which feels arbitrary and
    // leaves a leak undrilled.
    const spots = cycleLeakSpots(BEGINNER_6MAX, targets, 8, { rng: seeded(3) });
    const co = spots.filter((s) => s.itemKey.endsWith("/CO")).length;
    const btn = spots.filter((s) => s.itemKey.endsWith("/BTN")).length;

    expect(Math.abs(co - btn)).toBeLessThanOrEqual(1);
  });

  it("resumes the rotation where the offset says, not at the top", () => {
    const first = cycleLeakSpots(BEGINNER_6MAX, targets, 2, { rng: seeded(5) });
    const shifted = cycleLeakSpots(BEGINNER_6MAX, targets, 2, {
      rng: seeded(5),
      offset: 1,
    });

    // The offset is a position in the rotation, so one step along opens on the
    // next leak. A full lap (offset 2 with two leaks) correctly comes back
    // round to the start — that is what makes it a cycle.
    expect(shifted[0].itemKey).toBe(first[1].itemKey);
    expect(shifted[0].itemKey).not.toBe(first[0].itemKey);
  });

  it("mixes in neighbouring hands rather than only the ones misplayed", () => {
    const spots = cycleLeakSpots(BEGINNER_6MAX, targets, 12, { rng: seeded(11) });
    const misplayed = new Set(["K3o", "J4o"]);

    // Drilling only K3o teaches you K3o. Where the range *ends* is the part
    // that generalises, so some of the session must come from around it.
    expect(spots.some((s) => !misplayed.has(s.hand))).toBe(true);
    expect(spots.some((s) => misplayed.has(s.hand))).toBe(true);
  });

  it("never repeats the same hand at the same spot within a batch", () => {
    const spots = cycleLeakSpots(BEGINNER_6MAX, targets, 10, { rng: seeded(23) });
    const keys = spots.map((s) => `${s.itemKey}#${s.hand}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns nothing when there is nothing to drill", () => {
    expect(cycleLeakSpots(BEGINNER_6MAX, [], 5, { rng: seeded(1) })).toEqual([]);
  });
});
