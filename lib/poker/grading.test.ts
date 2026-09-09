import { describe, expect, it } from "vitest";
import type { Strategy } from "./charts";
import {
  INACCURACY_MAX_FREQ,
  gradeAction,
  rngCorrectAction,
  strategyBreakdown,
} from "./grading";

const PURE_RAISE: Strategy = { raise: { freq: 1 } };
const PURE_FOLD: Strategy = { fold: { freq: 1 } };
/** fold 30% / call 20% / raise 50% — rolls 1-30, 31-50, 51-100. */
const MIXED: Strategy = {
  fold: { freq: 0.3 },
  call: { freq: 0.2 },
  raise: { freq: 0.5 },
};

describe("the RNG die", () => {
  it("lays actions out passive to aggressive", () => {
    expect(rngCorrectAction(MIXED, 1)).toBe("fold");
    expect(rngCorrectAction(MIXED, 15)).toBe("fold");
    expect(rngCorrectAction(MIXED, 35)).toBe("call");
    expect(rngCorrectAction(MIXED, 75)).toBe("raise");
    expect(rngCorrectAction(MIXED, 100)).toBe("raise");
  });

  it("gives each boundary roll to the action that owns it", () => {
    // The off-by-one that would otherwise shift every frequency by 1%.
    expect(rngCorrectAction(MIXED, 30)).toBe("fold");
    expect(rngCorrectAction(MIXED, 31)).toBe("call");
    expect(rngCorrectAction(MIXED, 50)).toBe("call");
    expect(rngCorrectAction(MIXED, 51)).toBe("raise");
  });

  it("clamps rolls outside 1-100 rather than falling through", () => {
    expect(rngCorrectAction(MIXED, 0)).toBe("fold");
    expect(rngCorrectAction(MIXED, -5)).toBe("fold");
    expect(rngCorrectAction(MIXED, 999)).toBe("raise");
  });

  it("returns the only action for a pure strategy at any roll", () => {
    for (const roll of [1, 50, 100]) {
      expect(rngCorrectAction(PURE_RAISE, roll)).toBe("raise");
    }
  });

  it("reproduces the strategy's frequencies across all 100 rolls", () => {
    // The die is only honest if walking every roll recovers the distribution
    // it was built from. This is the property that makes it a randomiser
    // rather than a decoration.
    const counts: Record<string, number> = {};
    for (let roll = 1; roll <= 100; roll++) {
      const action = rngCorrectAction(MIXED, roll);
      counts[action] = (counts[action] ?? 0) + 1;
    }
    expect(counts.fold).toBe(30);
    expect(counts.call).toBe(20);
    expect(counts.raise).toBe(50);
  });

  it("gives an unclaimed top roll to the most aggressive live action", () => {
    // Hand-authored frequencies do not always sum to exactly 1.
    const slightlyShort: Strategy = { fold: { freq: 0.5 }, raise: { freq: 0.49 } };
    expect(rngCorrectAction(slightlyShort, 100)).toBe("raise");
  });
});

describe("grading against a pure strategy", () => {
  it("marks the prescribed action best", () => {
    const result = gradeAction(PURE_RAISE, "raise");
    expect(result.grade).toBe("best");
    expect(result.score).toBe(1);
  });

  it("marks folding a hand that should be raised wrong, not a blunder", () => {
    // Over-folding is an error, but it is the cheap kind — bounded by the pot
    // you would have won. Calling it a blunder would teach the wrong lesson.
    const result = gradeAction(PURE_RAISE, "fold");
    expect(result.grade).toBe("wrong");
    expect(result.expected).toBe("raise");
  });

  it("marks calling a hand that should be raised wrong, not a blunder", () => {
    // The hand belongs in the pot; only the line is off. Grading this as a
    // blunder would train a beginner to fear hands they should be playing.
    expect(gradeAction(PURE_RAISE, "call").grade).toBe("wrong");
  });

  it("never calls anything a blunder without knowing what it cost", () => {
    // Almost no preflop error is catastrophic. Opening T7o where the chart
    // folds it gives up a fraction of a big blind, and labelling that the same
    // as opening 32o under the gun would drain the word of meaning — and would
    // schedule an otherwise fine session as a failure.
    expect(gradeAction(PURE_FOLD, "call").grade).toBe("wrong");
    expect(gradeAction(PURE_FOLD, "raise").grade).toBe("wrong");
    expect(gradeAction(PURE_FOLD, "allin").grade).toBe("wrong");
  });

  it("starts its explanation with a capital letter", () => {
    // The rationale opens with the action name, which is lowercase in the data.
    const { rationale } = gradeAction(PURE_FOLD, "raise");
    expect(rationale[0]).toBe(rationale[0].toUpperCase());
  });
});

describe("grading against a mixed strategy without a die", () => {
  it("treats the modal action as best when no roll is supplied", () => {
    // Reviewing an already-played hand: no die was rolled at the table, so
    // there is nothing the player could have disobeyed.
    expect(gradeAction(MIXED, "raise").grade).toBe("best");
  });

  it("credits a real but non-modal action as correct", () => {
    const result = gradeAction(MIXED, "call");
    expect(result.grade).toBe("correct");
    expect(result.score).toBeGreaterThan(0);
  });

  it("rewards a correct action more than its bare frequency", () => {
    // The concave curve: a 20% action is worth well more than 0.2, because
    // finding it shows understanding rather than luck.
    expect(gradeAction(MIXED, "call").score).toBeGreaterThan(0.2);
  });

  it("calls a sub-threshold action an inaccuracy", () => {
    const rare: Strategy = {
      raise: { freq: 0.98 },
      call: { freq: 0.02 },
    };
    expect(0.02).toBeLessThan(INACCURACY_MAX_FREQ);
    const result = gradeAction(rare, "call");
    expect(result.grade).toBe("inaccuracy");
    expect(result.score).toBeLessThan(0);
  });
});

describe("grading against a mixed strategy with a die", () => {
  it("marks obedience to the die best", () => {
    expect(gradeAction(MIXED, "fold", { roll: 10 }).grade).toBe("best");
    expect(gradeAction(MIXED, "call", { roll: 40 }).grade).toBe("best");
    expect(gradeAction(MIXED, "raise", { roll: 80 }).grade).toBe("best");
  });

  it("treats disobeying the die as correct, not wrong", () => {
    // A failure of execution, not of knowledge — the player knew the strategy.
    const result = gradeAction(MIXED, "raise", { roll: 10 });
    expect(result.grade).toBe("correct");
    expect(result.expected).toBe("fold");
  });

  it("scores disobedience below the same action chosen without a die", () => {
    const withDie = gradeAction(MIXED, "call", { roll: 90 }).score;
    const withoutDie = gradeAction(MIXED, "call").score;
    expect(withDie).toBeLessThan(withoutDie);
  });

  it("still punishes an action outside the strategy entirely", () => {
    expect(gradeAction(MIXED, "allin", { roll: 50 }).grade).toBe("wrong");
  });

  it("mentions the roll in its explanation", () => {
    expect(gradeAction(MIXED, "raise", { roll: 10 }).rationale).toContain("10");
  });
});

describe("EV-aware grading", () => {
  const WITH_EV: Strategy = {
    raise: { freq: 1, ev: 2.4 },
    call: { freq: 0, ev: 1.9 },
    fold: { freq: 0, ev: 0 },
  };

  it("reports EV loss when the chart prices the alternatives", () => {
    expect(gradeAction(WITH_EV, "call").evLossBb).toBeCloseTo(0.5, 6);
  });

  it("reports no EV loss for the best action", () => {
    expect(gradeAction(WITH_EV, "raise").evLossBb).toBeCloseTo(0, 6);
  });

  it("leaves EV loss undefined for authored charts", () => {
    // Version one has no EV anywhere, and inventing a number would be worse
    // than admitting the chart does not know one.
    expect(gradeAction(PURE_RAISE, "fold").evLossBb).toBeUndefined();
  });

  it("uses EV rather than the fold heuristic once EV exists", () => {
    // Folding costs the whole 2.4bb here, well past the threshold, so this is
    // a blunder even though the player did not enter the pot — the opposite of
    // what the no-EV fallback would have concluded.
    expect(gradeAction(WITH_EV, "fold").grade).toBe("blunder");
  });

  it("scales the blunder threshold with the pot", () => {
    const smallLoss: Strategy = {
      raise: { freq: 1, ev: 1 },
      call: { freq: 0, ev: 0.8 },
    };
    // 0.2bb lost: a blunder in a 1bb pot, unremarkable in a 20bb pot.
    expect(gradeAction(smallLoss, "call", { potBb: 1 }).grade).toBe("blunder");
    expect(gradeAction(smallLoss, "call", { potBb: 20 }).grade).toBe("wrong");
  });
});

describe("strategyBreakdown", () => {
  it("lists every live action with its frequency", () => {
    const breakdown = strategyBreakdown(MIXED);
    expect(breakdown).toHaveLength(3);
    expect(breakdown.map((b) => b.action)).toEqual(["fold", "call", "raise"]);
  });

  it("omits actions that are never taken", () => {
    expect(strategyBreakdown(PURE_RAISE).map((b) => b.action)).toEqual(["raise"]);
  });
});
