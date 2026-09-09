import { describe, expect, it } from "vitest";
import { parseFile, parseHand, splitHands } from "./parse";

/** Unwrap a parse that is expected to succeed, failing loudly when it does not. */
function ok(raw: string) {
  const result = parseHand(raw);
  if (!result.ok) throw new Error(`expected a parse, got: ${result.error.reason}`);
  return result.hand;
}

/**
 * A 6-max Zoom cash hand, structurally as PokerStars writes them. Player names
 * are synthetic; the shape of the file is the thing under test.
 *
 * Note the double space after the hand number — that is real, and it has broken
 * parsers before.
 */
const CASH_HAND = `PokerStars Zoom Hand #164150709626:  Hold'em No Limit ($0.02/$0.05) - 2017/01/06 17:15:11 ET
Table 'Donati' 6-max Seat #1 is the button
Seat 1: Buttonesque ($0.96 in chips)
Seat 2: SmallBlindly ($23.69 in chips)
Seat 3: Heroic ($5 in chips)
Seat 4: UnderTheGun ($10 in chips)
Seat 5: HijackJack ($5 in chips)
Seat 6: CutoffCarl ($9.61 in chips)
SmallBlindly: posts small blind $0.02
Heroic: posts big blind $0.05
*** HOLE CARDS ***
Dealt to Heroic [Ac 4h]
UnderTheGun: folds
HijackJack: folds
CutoffCarl: raises $0.05 to $0.10
Buttonesque: calls $0.10
SmallBlindly: folds
Heroic: calls $0.05
*** FLOP *** [6c Jd 6d]
Heroic: checks
CutoffCarl: checks
Buttonesque: checks
*** TURN *** [6c Jd 6d] [2h]
Heroic: checks
CutoffCarl: checks
Buttonesque: checks
*** RIVER *** [6c Jd 6d 2h] [5d]
Heroic: bets $0.15
CutoffCarl: folds
Buttonesque: folds
Uncalled bet ($0.15) returned to Heroic
Heroic collected $0.31 from pot
Heroic: doesn't show hand
*** SUMMARY ***
Total pot $0.32 | Rake $0.01
Board [6c Jd 6d 2h 5d]
Seat 1: Buttonesque (button) folded on the River
Seat 2: SmallBlindly (small blind) folded before Flop
Seat 3: Heroic (big blind) collected ($0.31)
Seat 4: UnderTheGun folded before Flop (didn't bet)
Seat 5: HijackJack folded before Flop (didn't bet)
Seat 6: CutoffCarl folded on the River`;

const TOURNAMENT_HAND = `PokerStars Hand #219372022626: Tournament #3026510091, $1.84+$0.16 USD Hold'em No Limit - Level I (10/20) - 2020/10/14 10:33:59 BRT [2020/10/14 9:33:59 ET]
Table '3026510091 1' 3-max Seat #1 is the button
Seat 1: VillainA (500 in chips)
Seat 2: Heroic (500 in chips)
Seat 3: VillainB (500 in chips)
Heroic: posts small blind 10
VillainB: posts big blind 20
*** HOLE CARDS ***
Dealt to Heroic [6h Ks]
VillainB is disconnected
VillainA: folds
Heroic: calls 10
VillainB: checks
*** FLOP *** [4d Qs Qd]
Heroic: checks
VillainB: checks
*** TURN *** [4d Qs Qd] [3s]
Heroic: checks
VillainB: bets 20
Heroic: folds
Uncalled bet (20) returned to VillainB
VillainB collected 40 from pot
VillainB: doesn't show hand
*** SUMMARY ***
Total pot 40 | Rake 0
Board [4d Qs Qd 3s]
Seat 1: VillainA (button) folded before Flop (didn't bet)
Seat 2: Heroic (small blind) folded on the Turn
Seat 3: VillainB (big blind) collected (40)`;

describe("a cash hand", () => {
  const hand = ok(CASH_HAND);

  it("reads the header", () => {
    expect(hand.id).toBe("164150709626");
    expect(hand.gameType).toBe("cash");
    expect(hand.fastFold).toBe(true);
    expect(hand.smallBlind).toBe(0.02);
    expect(hand.bigBlind).toBe(0.05);
    expect(hand.currency).toBe("USD");
  });

  it("reads the table", () => {
    expect(hand.tableName).toBe("Donati");
    expect(hand.maxSeats).toBe(6);
    expect(hand.buttonSeat).toBe(1);
  });

  it("reads every seat and stack", () => {
    expect(hand.seats).toHaveLength(6);
    expect(hand.seats[0]).toMatchObject({
      seat: 1,
      player: "Buttonesque",
      stack: 0.96,
    });
    // "$5 in chips" with no decimals is as common as "$0.96".
    expect(hand.seats[2].stack).toBe(5);
  });

  it("identifies the hero and their cards", () => {
    expect(hand.hero).toEqual({ player: "Heroic", cards: ["Ac", "4h"] });
  });

  it("works out who was in which seat", () => {
    // Checked against the hand itself: SmallBlindly posts the small blind,
    // Heroic posts the big blind, and the button is seat 1.
    const byName = Object.fromEntries(hand.seats.map((s) => [s.player, s.position]));
    expect(byName).toEqual({
      SmallBlindly: "SB",
      Heroic: "BB",
      UnderTheGun: "UTG",
      HijackJack: "HJ",
      CutoffCarl: "CO",
      Buttonesque: "BTN",
    });
  });

  it("splits the action by street", () => {
    expect(hand.streets.map((s) => s.street)).toEqual([
      "preflop",
      "flop",
      "turn",
      "river",
    ]);
  });

  it("records a raise by its total, not its increment", () => {
    // "raises $0.05 to $0.10" means the player has $0.10 in. The increment is
    // almost always the wrong number to reason with.
    const raise = hand.streets[0].actions.find((a) => a.type === "raise");
    expect(raise).toMatchObject({ player: "CutoffCarl", amount: 0.1 });
  });

  it("keeps the blinds in the action list", () => {
    const preflop = hand.streets[0].actions;
    expect(preflop[0]).toMatchObject({ type: "post-sb", amount: 0.02 });
    expect(preflop[1]).toMatchObject({ type: "post-bb", amount: 0.05 });
  });

  it("records the uncalled bet being returned", () => {
    expect(
      hand.streets[3].actions.find((a) => a.type === "uncalled-return"),
    ).toMatchObject({ player: "Heroic", amount: 0.15 });
  });

  it("records the collect, which is the one line without a colon", () => {
    expect(hand.streets[3].actions.find((a) => a.type === "collect")).toMatchObject({
      player: "Heroic",
      amount: 0.31,
    });
  });

  it("builds the board a street at a time without repeating cards", () => {
    // Each street line repeats the board so far; only the last group is new.
    expect(hand.board).toEqual(["6c", "Jd", "6d", "2h", "5d"]);
    expect(hand.streets[2].cards).toEqual(["2h"]);
  });

  it("reads the pot and rake from the summary", () => {
    expect(hand.totalPot).toBe(0.32);
    expect(hand.rake).toBe(0.01);
  });

  it("converts the Eastern timestamp to an absolute instant", () => {
    // January, so Eastern Standard: five hours behind UTC.
    expect(hand.playedAt.toISOString()).toBe("2017-01-06T22:15:11.000Z");
  });

  it("keeps the raw text for replaying a future parser fix", () => {
    expect(hand.raw).toContain("PokerStars Zoom Hand #164150709626");
  });
});

describe("a tournament hand", () => {
  const hand = ok(TOURNAMENT_HAND);

  it("is recognised as a tournament played in chips", () => {
    expect(hand.gameType).toBe("tournament");
    expect(hand.tournamentId).toBe("3026510091");
    // Chips, not money — a currency here would invite converting them.
    expect(hand.currency).toBeNull();
    expect(hand.bigBlind).toBe(20);
  });

  it("prefers the bracketed Eastern stamp over the local one", () => {
    // The line carries 10:33:59 BRT and [9:33:59 ET]. October is daylight
    // saving, so Eastern is four hours behind UTC.
    expect(hand.playedAt.toISOString()).toBe("2020-10-14T13:33:59.000Z");
  });

  it("records a disconnect without treating it as an action on the pot", () => {
    expect(
      hand.streets[0].actions.find((a) => a.type === "disconnect")?.player,
    ).toBe("VillainB");
  });

  it("assigns three-handed positions", () => {
    const byName = Object.fromEntries(hand.seats.map((s) => [s.player, s.position]));
    expect(byName).toEqual({ Heroic: "SB", VillainB: "BB", VillainA: "BTN" });
  });
});

describe("the edge cases that break parsers", () => {
  const header = `PokerStars Hand #1:  Hold'em No Limit ($0.02/$0.05) - 2026/01/15 09:33:59 ET
Table 'Edge' 6-max Seat #1 is the button`;

  it("survives a player name containing spaces, brackets and a colon", () => {
    // Anchoring on `^(\w+):` finds the wrong boundary here, which is exactly
    // why the parser matches against the seat roster instead.
    const hand = ok(`${header}
Seat 1: odd (name) ($1 in chips)
Seat 2: a: b ($2 in chips)
Seat 3: plain ($3 in chips)
a: b: posts small blind $0.02
plain: posts big blind $0.05
*** HOLE CARDS ***
Dealt to plain [Ac 4h]
odd (name): raises $0.05 to $0.15
a: b: folds
plain: folds
Uncalled bet ($0.10) returned to odd (name)
odd (name) collected $0.12 from pot
*** SUMMARY ***
Total pot $0.12 | Rake $0`);

    expect(hand.seats.map((s) => s.player)).toEqual(["odd (name)", "a: b", "plain"]);
    const preflop = hand.streets[0].actions;
    expect(preflop.find((a) => a.type === "raise")).toMatchObject({
      player: "odd (name)",
      amount: 0.15,
    });
    expect(preflop.find((a) => a.type === "post-sb")?.player).toBe("a: b");
  });

  it("survives the missing 'Dealt to' line", () => {
    // A real PokerStars bug: hole cards were sometimes omitted entirely. The
    // hand is still worth keeping — we just do not know what we held.
    const hand = ok(`${header}
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
two: posts small blind $0.02
three: posts big blind $0.05
*** HOLE CARDS ***
one: folds
two: folds
Uncalled bet ($0.02) returned to three
three collected $0.04 from pot
*** SUMMARY ***
Total pot $0.04 | Rake $0`);

    expect(hand.hero).toBeUndefined();
    expect(hand.streets[0].actions.length).toBeGreaterThan(0);
  });

  it("never mistakes table chat for an action", () => {
    // The one place a hand history carries text written by someone else.
    const hand = ok(`${header}
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
two: posts small blind $0.02
three: posts big blind $0.05
*** HOLE CARDS ***
Dealt to one [Ac 4h]
one: said, "raises $100 to $200"
one: folds
two: folds
Uncalled bet ($0.02) returned to three
three collected $0.04 from pot
*** SUMMARY ***
Total pot $0.04 | Rake $0`);

    const preflop = hand.streets[0].actions;
    expect(preflop.some((a) => a.type === "raise")).toBe(false);
    expect(preflop.filter((a) => a.player === "one")).toHaveLength(1);
  });

  it("marks all-in actions", () => {
    const hand = ok(`${header}
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
two: posts small blind $0.02
three: posts big blind $0.05
*** HOLE CARDS ***
Dealt to one [Ac Ah]
one: raises $0.95 to $1 and is all-in
two: calls $0.98 and is all-in
three: folds
*** SUMMARY ***
Total pot $2.02 | Rake $0.05`);

    const preflop = hand.streets[0].actions;
    expect(preflop.find((a) => a.type === "raise")).toMatchObject({
      amount: 1,
      allIn: true,
    });
    expect(preflop.find((a) => a.type === "call")?.allIn).toBe(true);
  });

  it("excludes a sitting-out player from the position map", () => {
    // Five dealt in, not six — assigning six positions would shift everyone.
    const hand = ok(`${header}
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
Seat 4: four ($4 in chips)
Seat 5: five ($5 in chips)
Seat 6: six ($6 in chips) is sitting out
two: posts small blind $0.02
three: posts big blind $0.05
*** HOLE CARDS ***
Dealt to two [Ac 4h]
*** SUMMARY ***
Total pot $0.07 | Rake $0`);

    const byName = Object.fromEntries(hand.seats.map((s) => [s.player, s.position]));
    expect(byName.six).toBeNull();
    expect(byName.two).toBe("SB");
    expect(byName.three).toBe("BB");
    expect(byName.one).toBe("BTN");
  });

  it("gives heads-up the button the small blind", () => {
    // The exception every poker codebase gets wrong once: heads-up, the button
    // posts the small blind rather than acting last preflop.
    const hand = ok(`PokerStars Hand #2:  Hold'em No Limit ($0.02/$0.05) - 2026/01/15 09:33:59 ET
Table 'Duel' 2-max Seat #1 is the button
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
one: posts small blind $0.02
two: posts big blind $0.05
*** HOLE CARDS ***
Dealt to one [Ac 4h]
one: folds
Uncalled bet ($0.03) returned to two
two collected $0.04 from pot
*** SUMMARY ***
Total pot $0.04 | Rake $0`);

    expect(hand.seats.find((s) => s.player === "one")?.position).toBe("SB");
    expect(hand.seats.find((s) => s.player === "two")?.position).toBe("BB");
  });

  it("refuses to guess positions above six-handed", () => {
    // Whether the seat after the blinds is UTG or UTG+1 is genuinely contested,
    // and a wrong position files the hand under the wrong chart node.
    const hand = ok(`PokerStars Hand #3:  Hold'em No Limit ($0.02/$0.05) - 2026/01/15 09:33:59 ET
Table 'Ring' 9-max Seat #1 is the button
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
Seat 4: four ($4 in chips)
Seat 5: five ($5 in chips)
Seat 6: six ($6 in chips)
Seat 7: seven ($7 in chips)
two: posts small blind $0.02
three: posts big blind $0.05
*** HOLE CARDS ***
Dealt to two [Ac 4h]
*** SUMMARY ***
Total pot $0.07 | Rake $0`);

    expect(hand.seats.every((s) => s.position === null)).toBe(true);
  });

  it("keeps the first board when a hand is run twice", () => {
    const hand = ok(`${header}
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
two: posts small blind $0.02
three: posts big blind $0.05
*** HOLE CARDS ***
Dealt to two [Ac Ah]
one: raises $0.95 to $1 and is all-in
two: calls $0.98 and is all-in
three: folds
*** FIRST FLOP *** [6c Jd 6d]
*** FIRST TURN *** [6c Jd 6d] [2h]
*** FIRST RIVER *** [6c Jd 6d 2h] [5d]
*** SECOND FLOP *** [7s 8s 9s]
*** SECOND TURN *** [7s 8s 9s] [Ts]
*** SECOND RIVER *** [7s 8s 9s Ts] [Js]
*** SUMMARY ***
Total pot $2.02 | Rake $0.05`);

    expect(hand.board).toEqual(["6c", "Jd", "6d", "2h", "5d"]);
    expect(hand.extraBoards?.[0]).toEqual(["7s", "8s", "9s", "Ts", "Js"]);
  });

  it("reads a returning player posting both blinds at once", () => {
    const hand = ok(`${header}
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
two: posts small blind $0.02
three: posts big blind $0.05
one: posts small & big blinds $0.07
*** HOLE CARDS ***
Dealt to one [Ac 4h]
*** SUMMARY ***
Total pot $0.14 | Rake $0`);

    expect(
      hand.streets[0].actions.find((a) => a.type === "post-bb-and-sb"),
    ).toMatchObject({ player: "one", amount: 0.07 });
  });

  it("records shown cards at showdown", () => {
    const hand = ok(`${header}
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
Seat 3: three ($3 in chips)
two: posts small blind $0.02
three: posts big blind $0.05
*** HOLE CARDS ***
Dealt to two [Ac Ah]
one: folds
two: calls $0.03
three: checks
*** FLOP *** [6c Jd 6d]
two: checks
three: checks
*** SHOW DOWN ***
two: shows [Ac Ah] (two pair, Aces and Sixes)
three: mucks hand
two collected $0.10 from pot
*** SUMMARY ***
Total pot $0.10 | Rake $0`);

    const flop = hand.streets[1].actions;
    expect(flop.find((a) => a.type === "show")).toMatchObject({
      player: "two",
      cards: ["Ac", "Ah"],
    });
    expect(flop.find((a) => a.type === "muck")?.player).toBe("three");
  });
});

describe("daylight saving in the Eastern timestamps", () => {
  const at = (stamp: string) =>
    ok(`PokerStars Hand #9:  Hold'em No Limit ($0.02/$0.05) - ${stamp}
Table 'Clock' 2-max Seat #1 is the button
Seat 1: one ($1 in chips)
Seat 2: two ($2 in chips)
one: posts small blind $0.02
two: posts big blind $0.05
*** HOLE CARDS ***
Dealt to one [Ac 4h]
*** SUMMARY ***
Total pot $0.07 | Rake $0`).playedAt.toISOString();

  it("is five hours behind UTC in winter", () => {
    expect(at("2026/01/15 12:00:00 ET")).toBe("2026-01-15T17:00:00.000Z");
  });

  it("is four hours behind UTC in summer", () => {
    expect(at("2026/07/15 12:00:00 ET")).toBe("2026-07-15T16:00:00.000Z");
  });

  it("switches on the second Sunday in March", () => {
    // 2026: 8 March is the second Sunday. Before 2am is still standard time.
    expect(at("2026/03/08 01:00:00 ET")).toBe("2026-03-08T06:00:00.000Z");
    expect(at("2026/03/08 03:00:00 ET")).toBe("2026-03-08T07:00:00.000Z");
  });

  it("switches back on the first Sunday in November", () => {
    // 2026: 1 November.
    expect(at("2026/10/31 12:00:00 ET")).toBe("2026-10-31T16:00:00.000Z");
    expect(at("2026/11/02 12:00:00 ET")).toBe("2026-11-02T17:00:00.000Z");
  });
});

describe("reading a whole file", () => {
  it("splits hands apart", () => {
    expect(splitHands(`${CASH_HAND}\n\n\n${TOURNAMENT_HAND}\n`)).toHaveLength(2);
  });

  it("ignores leading noise before the first hand", () => {
    expect(splitHands(`\n\n${CASH_HAND}`)).toHaveLength(1);
  });

  it("keeps unparseable hands instead of dropping them", () => {
    // PokerStars changed this format twice in a year. A hand we cannot read
    // today is one a fixed parser reads tomorrow — but only if we kept it.
    const broken = `PokerStars Hand #999: something entirely new
Table 'Mystery' 6-max Seat #1 is the button`;
    const { hands, errors } = parseFile(`${CASH_HAND}\n\n${broken}`);

    expect(hands).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe("999");
    expect(errors[0].raw).toContain("something entirely new");
    expect(errors[0].reason).toMatch(/header/i);
  });

  it("reports a hand whose seats are missing rather than half-parsing it", () => {
    const seatless = `PokerStars Hand #1000:  Hold'em No Limit ($0.02/$0.05) - 2026/01/15 09:33:59 ET
Table 'Empty' 6-max Seat #1 is the button
*** HOLE CARDS ***`;
    const { errors } = parseFile(seatless);
    expect(errors[0].reason).toMatch(/no seats/i);
  });
});
