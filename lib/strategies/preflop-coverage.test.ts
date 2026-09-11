import { describe, expect, it } from "vitest";
import { heroDecisions } from "../hand-history/decisions";
import { parseFile } from "../hand-history/parse";
import { CTM_NL2 } from "./ctm-nl2";
import { reviewPreflopCoverage } from "./preflop-coverage";

function parsed(source: string) {
  const hand = parseFile(source).hands[0];
  if (!hand) throw new Error("Expected a parsed hand");
  return hand;
}

function review(source: string) {
  const hand = parsed(source);
  return reviewPreflopCoverage(
    hand,
    heroDecisions(hand, {
      treeId: CTM_NL2.chartSet.treeId,
      chartStackBb: CTM_NL2.chartSet.stackBb,
    }),
    CTM_NL2.chartSet,
  );
}

const HEADER = `PokerStars Hand #910000001:  Hold'em No Limit ($0.01/$0.02 USD) - 2026/01/01 12:00:00 ET
Table 'Six Max' 6-max Seat #3 is the button
Seat 1: VillainA ($0.80 in chips)
Seat 2: VillainB ($0.80 in chips)
Seat 3: VillainC ($0.80 in chips)
Seat 4: Hero ($0.80 in chips)
Seat 5: VillainD ($0.80 in chips)
Seat 6: VillainE ($0.80 in chips)
VillainA: posts small blind $0.01
VillainB: posts big blind $0.02
*** HOLE CARDS ***
`;

const SQUEEZE_HEADER = `PokerStars Hand #910000002:  Hold'em No Limit ($0.01/$0.02 USD) - 2026/01/01 12:00:00 ET
Table 'Six Max' 6-max Seat #6 is the button
Seat 1: VillainA ($0.80 in chips)
Seat 2: Hero ($0.80 in chips)
Seat 3: VillainC ($0.80 in chips)
Seat 4: VillainD ($0.80 in chips)
Seat 5: VillainE ($0.80 in chips)
Seat 6: VillainF ($0.80 in chips)
VillainA: posts small blind $0.01
Hero: posts big blind $0.02
*** HOLE CARDS ***
`;

describe("preflop decision coverage", () => {
  it("uses the short-stack three-bet response rather than the 100bb call range", () => {
    const decisions = review(`${HEADER}Dealt to Hero [Th Td]
VillainC: folds
Hero: raises $0.06 to $0.08
VillainD: raises $0.16 to $0.24
VillainE: folds
VillainA: folds
VillainB: folds
Hero: calls $0.16
*** SUMMARY ***
Total pot $0.50 | Rake $0`);

    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "facing-3bet",
          status: "gradeable",
          effectiveStackBb: 40,
          expected: "fold",
        }),
      ]),
    );
  });

  it("grades a sourced value squeeze", () => {
    const decisions = review(`${SQUEEZE_HEADER}Dealt to Hero [As Kd]
VillainC: raises $0.06 to $0.08
VillainA: calls $0.07
Hero: raises $0.24 to $0.32
VillainD: folds
VillainE: folds
VillainF: folds
*** SUMMARY ***
Total pot $0.52 | Rake $0`);

    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "squeeze",
          status: "gradeable",
          expected: "raise",
        }),
      ]),
    );
  });
});
