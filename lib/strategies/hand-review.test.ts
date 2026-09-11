import { describe, expect, it } from "vitest";
import { parseFile } from "../hand-history/parse";
import { CTM_NL2 } from "./ctm-nl2";
import { lessonForNode, reviewHandForStrategy } from "./hand-review";

const STORED = { id: "stored-hand", psHandId: "900000001" };

describe("strategy hand review", () => {
  it("assigns opening and facing-action nodes to their lesson", () => {
    expect(lessonForNode("ctm/100bb/rfi/CO")).toBe("open-with-purpose");
    expect(lessonForNode("ctm/100bb/vs-rfi/BTN/CO")).toBe("face-an-open");
    expect(lessonForNode("ctm/100bb/vs-3bet/CO/BTN")).toBe("three-bet-tree");
    expect(lessonForNode("ctm/100bb/vs-4bet/BTN/CO")).toBe("four-bet-tree");
  });

  it("only reviews hands that meet the strategy filter", () => {
    const source = `PokerStars Hand #900000001:  Hold'em No Limit ($0.01/$0.02 USD) - 2026/01/01 12:00:00 ET
Table 'Six Max' 6-max Seat #3 is the button
Seat 1: VillainA ($2 in chips)
Seat 2: VillainB ($2 in chips)
Seat 3: VillainC ($2 in chips)
Seat 4: Hero ($2 in chips)
Seat 5: VillainD ($2 in chips)
Seat 6: VillainE ($2 in chips)
VillainA: posts small blind $0.01
VillainB: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [As Kd]
VillainC: folds
Hero: raises $0.06 to $0.08
VillainD: folds
VillainE: folds
VillainA: folds
VillainB: folds
Uncalled bet ($0.06) returned to Hero
Hero collected $0.05 from pot
*** SUMMARY ***
Total pot $0.05 | Rake $0
`;
    const hand = parseFile(source).hands[0]!;

    const reviewed = reviewHandForStrategy(hand, STORED, CTM_NL2);
    expect(reviewed?.charted).toBe(1);

    const nineMax = { ...hand, maxSeats: 9 };
    expect(reviewHandForStrategy(nineMax, STORED, CTM_NL2)).toBeNull();
  });

  it("grades the response after the hero's open is three-bet", () => {
    const source = `PokerStars Hand #900000002:  Hold'em No Limit ($0.01/$0.02 USD) - 2026/01/01 12:02:00 ET
Table 'Six Max' 6-max Seat #3 is the button
Seat 1: VillainA ($2 in chips)
Seat 2: VillainB ($2 in chips)
Seat 3: VillainC ($2 in chips)
Seat 4: Hero ($2 in chips)
Seat 5: VillainD ($2 in chips)
Seat 6: VillainE ($2 in chips)
VillainA: posts small blind $0.01
VillainB: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [As Kd]
VillainC: folds
Hero: raises $0.06 to $0.08
VillainD: raises $0.06 to $0.24
VillainE: folds
VillainA: folds
VillainB: folds
Hero: calls $0.16
*** SUMMARY ***
Total pot $0.50 | Rake $0
`;
    const hand = parseFile(source).hands[0]!;

    const reviewed = reviewHandForStrategy(hand, STORED, CTM_NL2);
    expect(reviewed?.charted).toBe(2);
    expect(reviewed?.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: expect.stringContaining("/vs-3bet/"),
          chosen: "call",
          expected: "raise",
        }),
      ]),
    );
  });

  it("grades the response after the hero's three-bet is four-bet", () => {
    const source = `PokerStars Hand #900000003:  Hold'em No Limit ($0.01/$0.02 USD) - 2026/01/01 12:04:00 ET
Table 'Six Max' 6-max Seat #3 is the button
Seat 1: VillainA ($2 in chips)
Seat 2: VillainB ($2 in chips)
Seat 3: VillainC ($2 in chips)
Seat 4: Hero ($2 in chips)
Seat 5: VillainD ($2 in chips)
Seat 6: VillainE ($2 in chips)
VillainA: posts small blind $0.01
VillainB: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [Qs Qd]
VillainC: raises $0.06 to $0.08
Hero: raises $0.16 to $0.24
VillainD: folds
VillainE: folds
VillainA: folds
VillainB: folds
VillainC: raises $0.16 to $0.40
Hero: calls $0.16
*** SUMMARY ***
Total pot $0.82 | Rake $0
`;
    const hand = parseFile(source).hands[0]!;

    const reviewed = reviewHandForStrategy(hand, STORED, CTM_NL2);
    expect(reviewed?.charted).toBe(2);
    expect(reviewed?.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: expect.stringContaining("/vs-4bet/"),
          chosen: "call",
          expected: "fold",
        }),
      ]),
    );
  });
});
