import { describe, expect, it } from "vitest";
import { heroDecisions } from "./decisions";
import { parseHand } from "./parse";

const TREE = { treeId: "6max-2.5x", chartStackBb: 100 };

function decisionsFor(raw: string) {
  const result = parseHand(raw);
  if (!result.ok) throw new Error(`could not parse: ${result.error.reason}`);
  return heroDecisions(result.hand, TREE);
}

/** A 6-max cash hand at $0.02/$0.05, so one big blind is $0.05. */
function hand(body: string) {
  return `PokerStars Hand #1:  Hold'em No Limit ($0.02/$0.05) - 2026/01/15 09:33:59 ET
Table 'Decisions' 6-max Seat #1 is the button
Seat 1: Btn ($5 in chips)
Seat 2: Sb ($5 in chips)
Seat 3: Bb ($5 in chips)
Seat 4: Utg ($5 in chips)
Seat 5: Hj ($5 in chips)
Seat 6: Co ($5 in chips)
Sb: posts small blind $0.02
Bb: posts big blind $0.05
*** HOLE CARDS ***
${body}`;
}

describe("mapping an unopened pot to the opening node", () => {
  it("matches the cutoff opening after everyone folds", () => {
    const decisions = decisionsFor(
      hand(`Dealt to Co [Ac Kd]
Utg: folds
Hj: folds
Co: raises $0.05 to $0.125
Btn: folds
Sb: folds
Bb: folds
Uncalled bet ($0.075) returned to Co
Co collected $0.125 from pot
*** SUMMARY ***
Total pot $0.125 | Rake $0`),
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0].node).toEqual({
      scenario: "rfi",
      position: "CO",
      stackBb: 100,
      treeId: "6max-2.5x",
    });
    expect(decisions[0].hand).toBe("AKo");
    expect(decisions[0].actual).toBe("raise");
  });

  it("measures the pot and price in big blinds", () => {
    const decisions = decisionsFor(
      hand(`Dealt to Utg [Ac Kd]
Utg: folds
Hj: folds
Co: folds
Btn: folds
Sb: folds
Uncalled bet ($0.02) returned to Bb
Bb collected $0.04 from pot
*** SUMMARY ***
Total pot $0.04 | Rake $0`),
    );

    // Blinds only: $0.07 at a $0.05 big blind is 1.4bb, and it costs 1bb to play.
    expect(decisions[0].potBb).toBe(1.4);
    expect(decisions[0].toCallBb).toBe(1);
    expect(decisions[0].stackBb).toBe(100);
  });
});

describe("mapping a single raise to the facing-a-raise node", () => {
  it("records who raised and from where", () => {
    const decisions = decisionsFor(
      hand(`Dealt to Bb [Ah 4h]
Utg: folds
Hj: folds
Co: folds
Btn: raises $0.05 to $0.125
Sb: folds
Bb: folds
Uncalled bet ($0.075) returned to Btn
Btn collected $0.125 from pot
*** SUMMARY ***
Total pot $0.125 | Rake $0`),
    );

    expect(decisions[0].node).toMatchObject({
      scenario: "vs-rfi",
      position: "BB",
      villain: "BTN",
    });
    expect(decisions[0].toCallBb).toBe(1.5); // $0.125 less the $0.05 already posted
  });
});

describe("refusing to match spots the chart does not describe", () => {
  it("grades a limped pot with the opening range", () => {
    // The reverse of what this asserted until chart version 4, and the reversal
    // is the point. The ranges now loaded come from a book whose own scope note
    // is that they apply "when you are first to enter the pot or there have
    // been limpers". Refusing these left a large share of micro-stakes hands
    // ungraded, where limped pots are common.
    const decisions = decisionsFor(
      hand(`Dealt to Co [Ac Kd]
Utg: calls $0.05
Hj: folds
Co: raises $0.05 to $0.20
Btn: folds
Sb: folds
Bb: folds
Utg: folds
Uncalled bet ($0.15) returned to Co
Co collected $0.17 from pot
*** SUMMARY ***
Total pot $0.17 | Rake $0`),
    );

    expect(decisions[0].node?.scenario).toBe("rfi");
    expect(decisions[0].node?.position).toBe("CO");
    // Still an opening decision, so still no villain to face.
    expect(decisions[0].node?.villain).toBeUndefined();
  });

  it("leaves a cold-called raise unmatched", () => {
    // Someone calling between the raiser and the hero makes this a squeeze
    // spot, which the beginner set does not cover.
    const decisions = decisionsFor(
      hand(`Dealt to Bb [Ah 4h]
Utg: raises $0.05 to $0.125
Hj: calls $0.125
Co: folds
Btn: folds
Sb: folds
Bb: folds
*** SUMMARY ***
Total pot $0.30 | Rake $0`),
    );

    expect(decisions[0].node).toBeUndefined();
  });

  it("leaves a three-bet pot unmatched", () => {
    const decisions = decisionsFor(
      hand(`Dealt to Bb [Ah Ad]
Utg: raises $0.05 to $0.125
Hj: raises $0.125 to $0.40
Co: folds
Btn: folds
Sb: folds
Bb: folds
Utg: folds
*** SUMMARY ***
Total pot $0.60 | Rake $0`),
    );

    expect(decisions[0].node).toBeUndefined();
  });

  it("charts the big blind's option once a pot is limped to it", () => {
    // Reversed in chart version 5. A limped pot puts a real question to the big
    // blind — raise over the limper or take the free flop — and it is the one
    // the opening ranges answer. Folded round is still nothing: the blind wins
    // without acting, and there is no decision to grade.
    //
    // 72o checks, which maps to declining to commit chips, which is what the
    // chart wants. So this is a graded decision and a correct one.
    const decisions = decisionsFor(
      hand(`Dealt to Bb [7h 2d]
Utg: folds
Hj: folds
Co: folds
Btn: folds
Sb: calls $0.03
Bb: checks
*** FLOP *** [6c Jd 6d]
Sb: checks
Bb: checks
*** SUMMARY ***
Total pot $0.10 | Rake $0`),
    );

    expect(decisions[0].node?.scenario).toBe("rfi");
    expect(decisions[0].node?.position).toBe("BB");
    expect(decisions[0].actual).toBe("fold");
  });

  it("still ignores the big blind when the pot is folded round", () => {
    // Nobody limped, so nobody put the question. The blind wins uncontested.
    const decisions = decisionsFor(
      hand(`Dealt to Bb [7h 2d]
Utg: folds
Hj: folds
Co: folds
Btn: folds
Sb: folds
Uncalled bet ($0.02) returned to Bb
Bb collected $0.05 from pot
*** SUMMARY ***
Total pot $0.05 | Rake $0`),
    );

    expect(decisions.every((d) => d.node === undefined)).toBe(true);
  });

  it("charts a clean response after the hero is three-bet", () => {
    const decisions = decisionsFor(
      hand(`Dealt to Co [Ac Kd]
Utg: folds
Hj: folds
Co: raises $0.05 to $0.125
Btn: raises $0.125 to $0.40
Sb: folds
Bb: folds
Co: folds
*** SUMMARY ***
Total pot $0.60 | Rake $0`),
    );

    const preflop = decisions.filter((d) => d.street === "preflop");
    expect(preflop).toHaveLength(2);
    expect(preflop[0].node).toMatchObject({ scenario: "rfi", position: "CO" });
    expect(preflop[1].node).toMatchObject({
      scenario: "vs-3bet",
      position: "CO",
      villain: "BTN",
    });
  });

  it("charts a clean response after the hero is four-bet", () => {
    const decisions = decisionsFor(
      hand(`Dealt to Co [Ac Kd]
Utg: raises $0.05 to $0.125
Hj: folds
Co: raises $0.125 to $0.40
Btn: folds
Sb: folds
Bb: folds
Utg: raises $0.40 to $1.20
Co: calls $0.80
*** SUMMARY ***
Total pot $2.45 | Rake $0`),
    );

    const preflop = decisions.filter((d) => d.street === "preflop");
    expect(preflop).toHaveLength(2);
    expect(preflop[0].node).toMatchObject({
      scenario: "vs-rfi",
      position: "CO",
      villain: "UTG",
    });
    expect(preflop[1].node).toMatchObject({
      scenario: "vs-4bet",
      position: "CO",
      villain: "UTG",
    });
  });
});

describe("decisions after the flop", () => {
  const decisions = decisionsFor(
    hand(`Dealt to Bb [Ah Kh]
Utg: folds
Hj: folds
Co: folds
Btn: raises $0.05 to $0.125
Sb: folds
Bb: calls $0.075
*** FLOP *** [Ac 7d 2s]
Bb: checks
Btn: bets $0.10
Bb: raises $0.10 to $0.35
Btn: folds
Uncalled bet ($0.25) returned to Bb
Bb collected $0.45 from pot
*** SUMMARY ***
Total pot $0.45 | Rake $0.02`),
  );

  it("carries every street's decisions through", () => {
    expect(decisions.map((d) => d.street)).toEqual(["preflop", "flop", "flop"]);
  });

  it("never attaches a node to a postflop decision", () => {
    // The chart set is preflop only. Claiming otherwise would be exactly the
    // overreach the platform is built to avoid.
    for (const decision of decisions.filter((d) => d.street !== "preflop")) {
      expect(decision.node).toBeUndefined();
    }
  });

  it("carries the pot forward from the previous street", () => {
    // Two players at $0.125 each, plus the small blind's dead $0.02 — $0.27,
    // which is 5.4bb. Forgetting abandoned blinds is the classic way to
    // under-count a pot, and it makes every pot-relative figure wrong.
    const flopCheck = decisions.find((d) => d.street === "flop");
    expect(flopCheck?.potBb).toBe(5.4);
    expect(flopCheck?.toCallBb).toBe(0);
  });

  it("prices a bet the hero is facing", () => {
    const facingBet = decisions.filter((d) => d.street === "flop")[1];
    expect(facingBet.toCallBb).toBe(2); // $0.10 at a $0.05 big blind
    expect(facingBet.actual).toBe("raise");
    expect(facingBet.actualBb).toBe(7); // raised to $0.35
  });
});

describe("the call-versus-raise amount convention", () => {
  it("treats a call as the increment and a raise as the street total", () => {
    // PokerStars writes these two differently and getting it wrong silently
    // corrupts every pot. Here the big blind has already posted $0.05 and calls
    // a raise to $0.10, so the history says "calls $0.05" — meaning the player
    // now has $0.10 in, not $0.15.
    const decisions = decisionsFor(
      hand(`Dealt to Bb [Ah Kh]
Utg: folds
Hj: folds
Co: raises $0.05 to $0.10
Btn: calls $0.10
Sb: folds
Bb: calls $0.05
*** FLOP *** [Ac 7d 2s]
Bb: checks
Co: checks
Btn: checks
*** SUMMARY ***
Total pot $0.32 | Rake $0.01`),
    );

    // Three players with $0.10 each plus the small blind's dead $0.02 is
    // $0.32 — which is exactly what the summary line reports.
    const flop = decisions.find((d) => d.street === "flop");
    expect(flop?.potBb).toBe(6.4);
  });
});

describe("hands that cannot be graded", () => {
  it("returns nothing when the hero's cards are unknown", () => {
    // The missing "Dealt to" line. The hand is still stored; there is simply
    // nothing to judge.
    const decisions = decisionsFor(
      hand(`Utg: folds
Hj: folds
Co: folds
Btn: folds
Sb: folds
Uncalled bet ($0.02) returned to Bb
Bb collected $0.04 from pot
*** SUMMARY ***
Total pot $0.04 | Rake $0`),
    );

    expect(decisions).toEqual([]);
  });

  it("returns a decision but no node when positions are unknown", () => {
    // Nine-handed, where the naming convention is contested, so the parser
    // assigns no positions and nothing can be charted.
    const decisions = decisionsFor(
      `PokerStars Hand #7:  Hold'em No Limit ($0.02/$0.05) - 2026/01/15 09:33:59 ET
Table 'Ring' 9-max Seat #1 is the button
Seat 1: One ($5 in chips)
Seat 2: Two ($5 in chips)
Seat 3: Three ($5 in chips)
Seat 4: Four ($5 in chips)
Seat 5: Five ($5 in chips)
Seat 6: Six ($5 in chips)
Seat 7: Seven ($5 in chips)
Two: posts small blind $0.02
Three: posts big blind $0.05
*** HOLE CARDS ***
Dealt to Four [Ac Kd]
Four: raises $0.05 to $0.125
Five: folds
Six: folds
Seven: folds
One: folds
Two: folds
Three: folds
Uncalled bet ($0.075) returned to Four
Four collected $0.125 from pot
*** SUMMARY ***
Total pot $0.125 | Rake $0`,
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0].node).toBeUndefined();
  });
});
