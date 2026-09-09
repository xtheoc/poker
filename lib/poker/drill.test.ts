import { describe, expect, it } from "vitest";
import { type ChartNode, activeActions, strategyFor } from "./charts";
import { BEGINNER_6MAX } from "./charts/beginner-6max";
import { MAX_ERROR_MULTIPLIER, sampleDrillHands, tallyErrors } from "./drill";

/** A deterministic generator, so a sampling test never flakes. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // xorshift32 — small, fast, and good enough to sample with.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

const BTN_OPEN = BEGINNER_6MAX.nodes.find(
  (n) => n.key.position === "BTN" && !n.key.villain,
)!;
const UTG_OPEN = BEGINNER_6MAX.nodes.find(
  (n) => n.key.position === "UTG" && !n.key.villain,
)!;

function isPlayed(node: ChartNode, hand: string): boolean {
  const actions = activeActions(strategyFor(node, hand));
  return !(actions.length === 1 && actions[0] === "fold");
}

describe("sampling hands to drill", () => {
  it("returns the number of hands asked for", () => {
    expect(sampleDrillHands(BTN_OPEN, 8, { rng: seeded(1) })).toHaveLength(8);
  });

  it("never repeats a hand within one session", () => {
    // Seeing the same hand twice in a short drill tests nothing and reads as
    // a bug.
    for (let seed = 1; seed <= 25; seed++) {
      const drawn = sampleDrillHands(UTG_OPEN, 12, { rng: seeded(seed) });
      expect(new Set(drawn.map((d) => d.hand)).size).toBe(drawn.length);
    }
  });

  it("shows far more playable hands than dealing at random would", () => {
    // The whole point of the sampler. UTG plays about 13% of hands, so honest
    // random dealing would make a drill roughly seven-eighths folding trash.
    let played = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const drawn of sampleDrillHands(UTG_OPEN, 10, { rng: seeded(seed) })) {
        if (isPlayed(UTG_OPEN, drawn.hand)) played++;
        total++;
      }
    }
    const playedShare = played / total;
    expect(playedShare).toBeGreaterThan(0.35);
    expect(playedShare).toBeLessThan(0.65);
  });

  it("honours an explicit play ratio", () => {
    let played = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const drawn of sampleDrillHands(UTG_OPEN, 10, {
        rng: seeded(seed),
        playRatio: 0.8,
      })) {
        if (isPlayed(UTG_OPEN, drawn.hand)) played++;
        total++;
      }
    }
    expect(played / total).toBeGreaterThan(0.7);
  });

  it("still shows folds, so the range keeps an edge to feel", () => {
    // A drill of only playable hands teaches "always play", which is worse
    // than teaching nothing.
    let folds = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (const drawn of sampleDrillHands(UTG_OPEN, 10, { rng: seeded(seed) })) {
        if (!isPlayed(UTG_OPEN, drawn.hand)) folds++;
      }
    }
    expect(folds).toBeGreaterThan(0);
  });

  it("favours hands the player keeps getting wrong", () => {
    const target = "A5o";
    const errorCounts = new Map([[target, 10]]);

    const countAppearances = (counts?: Map<string, number>) => {
      let seen = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const drawn = sampleDrillHands(BTN_OPEN, 10, {
          rng: seeded(seed),
          errorCounts: counts,
        });
        if (drawn.some((d) => d.hand === target)) seen++;
      }
      return seen;
    };

    expect(countAppearances(errorCounts)).toBeGreaterThan(countAppearances());
  });

  it("caps how far past errors can skew the drill", () => {
    // One catastrophic night must not turn the next month into a single hand
    // on repeat, so the multiplier is bounded rather than proportional. The
    // guarantee is therefore *not* that a much-missed hand always appears —
    // it is that it cannot crowd the session out. An absurd error count should
    // still leave most sessions covering other ground.
    expect(MAX_ERROR_MULTIPLIER).toBeLessThanOrEqual(10);

    const obsessive = new Map([["72o", 1000]]);
    let sessionsContaining = 0;

    for (let seed = 1; seed <= 40; seed++) {
      const drawn = sampleDrillHands(BTN_OPEN, 10, {
        rng: seeded(seed),
        errorCounts: obsessive,
      });
      // Never twice in one session, however badly it has been missed.
      expect(drawn.filter((d) => d.hand === "72o").length).toBeLessThanOrEqual(1);
      expect(new Set(drawn.map((d) => d.hand)).size).toBe(10);
      if (drawn.some((d) => d.hand === "72o")) sessionsContaining++;
    }

    // It shows up sometimes, but nowhere near always — the cap is doing work.
    expect(sessionsContaining).toBeLessThan(40);
  });

  it("does not roll a die at a pure node", () => {
    // A die implies the decision is a coin flip. At a pure node it is not, and
    // showing one would teach a strategy that does not exist.
    for (const drawn of sampleDrillHands(BTN_OPEN, 12, { rng: seeded(3) })) {
      expect(drawn.roll).toBeUndefined();
    }
  });

  it("copes with asking for more hands than the node has", () => {
    const drawn = sampleDrillHands(UTG_OPEN, 500, { rng: seeded(2) });
    expect(drawn).toHaveLength(169);
    expect(new Set(drawn.map((d) => d.hand)).size).toBe(169);
  });

  it("carries each hand's strategy with it", () => {
    for (const drawn of sampleDrillHands(BTN_OPEN, 6, { rng: seeded(9) })) {
      expect(activeActions(drawn.strategy).length).toBeGreaterThan(0);
    }
  });
});

describe("tallying past errors", () => {
  it("counts wrong actions and blunders", () => {
    const counts = tallyErrors([
      { hand: "AJo", action_grade: "wrong" },
      { hand: "AJo", action_grade: "blunder" },
      { hand: "KQo", action_grade: "wrong" },
    ]);
    expect(counts.get("AJo")).toBe(2);
    expect(counts.get("KQo")).toBe(1);
  });

  it("ignores correct play", () => {
    const counts = tallyErrors([
      { hand: "AA", action_grade: "best" },
      { hand: "AA", action_grade: "correct" },
    ]);
    expect(counts.get("AA")).toBeUndefined();
  });

  it("ignores inaccuracies", () => {
    // By definition the errors that cost almost nothing. Drilling them harder
    // would spend the session on the least valuable thing available.
    const counts = tallyErrors([{ hand: "T9s", action_grade: "inaccuracy" }]);
    expect(counts.get("T9s")).toBeUndefined();
  });

  it("skips rows with no hand recorded", () => {
    expect(tallyErrors([{ hand: null, action_grade: "blunder" }]).size).toBe(0);
  });
});
