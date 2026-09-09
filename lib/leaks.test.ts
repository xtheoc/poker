import { describe, expect, it } from "vitest";
import { heroDecisions } from "./hand-history/decisions";
import { parseHand } from "./hand-history/parse";
import { type Violation, findLeaks, violationsInHand } from "./leaks";
import { BEGINNER_6MAX } from "./poker/charts/beginner-6max";

const TREE = { treeId: "6max-2.5x", chartStackBb: 100 };

/**
 * A hand where the hero acts under the gun and everyone else folds around, so
 * the spot is exactly the charted "folded to you" node.
 */
function openingHand(options: {
  id: string;
  at: string;
  cards: string;
  action: "raises $0.05 to $0.125" | "folds";
}) {
  return `PokerStars Hand #${options.id}:  Hold'em No Limit ($0.02/$0.05) - ${options.at} ET
Table 'Leaks' 6-max Seat #1 is the button
Seat 1: Btn ($5 in chips)
Seat 2: Sb ($5 in chips)
Seat 3: Bb ($5 in chips)
Seat 4: Utg ($5 in chips)
Seat 5: Hj ($5 in chips)
Seat 6: Co ($5 in chips)
Sb: posts small blind $0.02
Bb: posts big blind $0.05
*** HOLE CARDS ***
Dealt to Utg [${options.cards}]
Utg: ${options.action}
Hj: folds
Co: folds
Btn: folds
Sb: folds
Uncalled bet ($0.02) returned to Bb
Bb collected $0.04 from pot
*** SUMMARY ***
Total pot $0.04 | Rake $0`;
}

function violationsOf(raw: string): Violation[] {
  const result = parseHand(raw);
  if (!result.ok) throw new Error(`could not parse: ${result.error.reason}`);
  return violationsInHand(
    result.hand,
    heroDecisions(result.hand, TREE),
    BEGINNER_6MAX,
  );
}

describe("checking a decision against the chart", () => {
  it("says nothing when the hand was played correctly", () => {
    // AA opened under the gun. A leak engine that finds leaks in good play is
    // the specific failure mode worth guarding against.
    expect(
      violationsOf(
        openingHand({
          id: "1",
          at: "2026/01/15 12:00:00",
          cards: "Ac Ad",
          action: "raises $0.05 to $0.125",
        }),
      ),
    ).toEqual([]);
  });

  it("flags opening a hand the chart folds", () => {
    const violations = violationsOf(
      openingHand({
        id: "2",
        at: "2026/01/15 12:00:00",
        cards: "7h 2d",
        action: "raises $0.05 to $0.125",
      }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      hand: "72o",
      chosen: "raise",
      expected: "fold",
      kind: "too-loose",
      spot: "UTG open",
    });
  });

  it("flags folding a hand the chart opens", () => {
    const violations = violationsOf(
      openingHand({
        id: "3",
        at: "2026/01/15 12:00:00",
        cards: "Ac Kd",
        action: "folds",
      }),
    );

    expect(violations[0]).toMatchObject({
      hand: "AKo",
      chosen: "fold",
      expected: "raise",
      kind: "too-tight",
    });
  });

  it("carries no cost figure while the chart carries no EV", () => {
    // Inventing a big-blind number here would be exactly the false precision
    // this platform is built to avoid.
    const violations = violationsOf(
      openingHand({
        id: "4",
        at: "2026/01/15 12:00:00",
        cards: "7h 2d",
        action: "raises $0.05 to $0.125",
      }),
    );
    expect(violations[0].evLossBb).toBeUndefined();
  });
});

describe("grouping violations into leaks", () => {
  const violation = (
    overrides: Partial<Violation> & { at: string },
  ): Violation => ({
    handId: overrides.handId ?? "h",
    playedAt: new Date(overrides.at),
    hand: overrides.hand ?? "72o",
    nodeId: overrides.nodeId ?? "6max-2.5x/100bb/rfi/UTG",
    spot: overrides.spot ?? "UTG open",
    chosen: overrides.chosen ?? "raise",
    expected: overrides.expected ?? "fold",
    grade: overrides.grade ?? "wrong",
    kind: overrides.kind ?? "too-loose",
    evLossBb: overrides.evLossBb,
  });

  it("will not call a single mistake a habit, but will still drill it", () => {
    // The distinction that matters: one mistake is not evidence of a *pattern*,
    // so the label stays cautious. It is still a verified mistake — the hand
    // really was outside the range — so there is nothing uncertain to protect
    // against, and no reason to withhold the practice.
    const leaks = findLeaks([violation({ at: "2026-01-15T12:00:00Z" })]);
    expect(leaks[0].confidence).toBe("watching");
    expect(leaks[0].drillable).toBe(true);
  });

  it("will not promote a pattern that only appeared in one sitting", () => {
    // Five of the same error inside ten minutes is more likely one bad session
    // than a habit, so the label stays cautious even though the count is high.
    const leaks = findLeaks([
      violation({ at: "2026-01-15T12:00:00Z", handId: "a" }),
      violation({ at: "2026-01-15T12:02:00Z", handId: "b" }),
      violation({ at: "2026-01-15T12:04:00Z", handId: "c" }),
      violation({ at: "2026-01-15T12:06:00Z", handId: "d" }),
      violation({ at: "2026-01-15T12:08:00Z", handId: "e" }),
    ]);

    expect(leaks[0].sessions).toBe(1);
    expect(leaks[0].confidence).toBe("watching");
  });

  it("promotes a pattern that recurs across sittings", () => {
    const leaks = findLeaks([
      violation({ at: "2026-01-15T12:00:00Z", handId: "a" }),
      violation({ at: "2026-01-16T12:00:00Z", handId: "b" }),
      violation({ at: "2026-01-17T12:00:00Z", handId: "c" }),
    ]);

    expect(leaks[0].sessions).toBe(3);
    expect(leaks[0].confidence).toBe("likely");
    expect(leaks[0].drillable).toBe(true);
  });

  it("keeps the offending hands as evidence", () => {
    const leaks = findLeaks([
      violation({ at: "2026-01-15T12:00:00Z", handId: "a", hand: "72o" }),
      violation({ at: "2026-01-16T12:00:00Z", handId: "b", hand: "J4o" }),
      violation({ at: "2026-01-17T12:00:00Z", handId: "c", hand: "72o" }),
    ]);

    expect(leaks[0].handIds).toHaveLength(3);
    expect([...leaks[0].hands].sort()).toEqual(["72o", "J4o"]);
  });

  it("separates different mistakes at the same spot", () => {
    // Opening too wide and folding too much in the same seat are two different
    // problems with two different fixes.
    const leaks = findLeaks([
      violation({ at: "2026-01-15T12:00:00Z", kind: "too-loose" }),
      violation({ at: "2026-01-16T12:00:00Z", kind: "too-tight" }),
    ]);
    expect(leaks).toHaveLength(2);
  });

  it("ranks the frequent small error above the rare one", () => {
    // The mistake every naive leak-finder makes is the other way round.
    const frequent = Array.from({ length: 10 }, (_, i) =>
      violation({
        at: `2026-01-${String(10 + i).padStart(2, "0")}T12:00:00Z`,
        nodeId: "6max-2.5x/100bb/rfi/CO",
        spot: "CO open",
      }),
    );
    const rare = [
      violation({
        at: "2026-02-01T12:00:00Z",
        nodeId: "6max-2.5x/100bb/rfi/UTG",
        spot: "UTG open",
      }),
    ];

    const leaks = findLeaks([...rare, ...frequent]);
    expect(leaks[0].spot).toBe("CO open");
    expect(leaks[0].instances).toBe(10);
  });

  it("prefers real EV over the ordering weights once it exists", () => {
    // A single genuinely expensive error should outrank several cheap ones the
    // moment a source can actually price them.
    const leaks = findLeaks([
      violation({ at: "2026-01-15T12:00:00Z", nodeId: "cheap", evLossBb: 0.1 }),
      violation({ at: "2026-01-16T12:00:00Z", nodeId: "cheap", evLossBb: 0.1 }),
      violation({ at: "2026-01-17T12:00:00Z", nodeId: "cheap", evLossBb: 0.1 }),
      violation({ at: "2026-01-18T12:00:00Z", nodeId: "costly", evLossBb: 5 }),
    ]);

    expect(leaks[0].nodeId).toBe("costly");
    expect(leaks[0].totalCostBb).toBe(5);
  });

  it("reports no total when only some instances carry a cost", () => {
    // A partial sum would understate the leak while looking authoritative.
    const leaks = findLeaks([
      violation({ at: "2026-01-15T12:00:00Z", evLossBb: 0.5 }),
      violation({ at: "2026-01-16T12:00:00Z" }),
    ]);
    expect(leaks[0].totalCostBb).toBeUndefined();
  });

  it("names the leak in terms of the fix, not the hands", () => {
    const leaks = findLeaks([violation({ at: "2026-01-15T12:00:00Z" })]);
    expect(leaks[0].label).toBe("Playing hands that should fold — UTG open");
  });
});
