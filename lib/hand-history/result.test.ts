import { describe, expect, it } from "vitest";
import { parseHand } from "./parse";
import { heroResult } from "./result";

function resultFor(raw: string) {
  const parsed = parseHand(raw);
  if (!parsed.ok) throw new Error(`could not parse: ${parsed.error.reason}`);
  return heroResult(parsed.hand);
}

/** A 6-max cash hand at $0.02/$0.05, so one big blind is $0.05. */
function hand(body: string) {
  return `PokerStars Hand #1:  Hold'em No Limit ($0.02/$0.05) - 2026/01/15 09:33:59 ET
Table 'Results' 6-max Seat #1 is the button
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

describe("what a hand cost or made", () => {
  it("counts a walk in the big blind as a small win", () => {
    const result = resultFor(
      hand(`Dealt to Bb [Ah 4h]
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

    // The blind is posted, then $0.02 of it is handed back and $0.04 collected:
    // $0.03 left in, $0.04 out, so $0.01 profit at a $0.05 big blind.
    expect(result?.netBb).toBeCloseTo(0.2, 5);
    expect(result?.vpip).toBe(false);
    expect(result?.pfr).toBe(false);
  });

  it("reports a preflop loss in big blinds", () => {
    const result = resultFor(
      hand(`Dealt to Co [Kd 3s]
Utg: folds
Hj: folds
Co: raises $0.05 to $0.125
Btn: raises $0.25 to $0.375
Sb: folds
Bb: folds
Co: folds
Uncalled bet ($0.25) returned to Btn
Btn collected $0.32 from pot
*** SUMMARY ***
Total pot $0.32 | Rake $0`),
    );

    // Opened to $0.125 and folded to the three-bet: 2.5bb gone.
    expect(result?.netBb).toBeCloseTo(-2.5, 5);
    expect(result?.vpip).toBe(true);
    expect(result?.pfr).toBe(true);
    expect(result?.sawFlop).toBe(false);
    expect(result?.handClass).toBe("K3o");
    expect(result?.position).toBe("CO");
  });

  it("separates winning at showdown from winning without one", () => {
    const shown = resultFor(
      hand(`Dealt to Bb [Ah Ad]
Utg: folds
Hj: folds
Co: raises $0.05 to $0.125
Btn: folds
Sb: folds
Bb: calls $0.075
*** FLOP *** [2c 7d Ts]
Bb: checks
Co: bets $0.10
Bb: calls $0.10
*** TURN *** [2c 7d Ts] [4h]
Bb: checks
Co: checks
*** RIVER *** [2c 7d Ts 4h] [9c]
Bb: checks
Co: checks
*** SHOW DOWN ***
Bb: shows [Ah Ad] (a pair of Aces)
Co: mucks hand
Bb collected $0.44 from pot
*** SUMMARY ***
Total pot $0.46 | Rake $0.02`),
    );

    expect(shown?.sawFlop).toBe(true);
    expect(shown?.wentToShowdown).toBe(true);
    expect(shown?.wonAtShowdown).toBe(true);
    // $0.225 in across the hand, $0.44 collected.
    expect(shown?.netBb).toBeCloseTo(4.3, 5);
  });

  it("does not call a hand a showdown when everyone else folded", () => {
    const result = resultFor(
      hand(`Dealt to Btn [As Ks]
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

    expect(result?.wentToShowdown).toBe(false);
    expect(result?.won).toBe(true);
    expect(result?.sawFlop).toBe(false);
  });

  it("has nothing to report for a hand that was only observed", () => {
    const result = resultFor(
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

    expect(result).toBeNull();
  });
});
