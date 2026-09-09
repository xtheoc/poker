import { describe, expect, it } from "vitest";
import {
  type ChartNode,
  type Position,
  activeActions,
  freqOf,
  nodeId,
  offeredActions,
  openSizeBb,
  strategyError,
  strategyFor,
  wagerBb,
} from "../charts";
import { allHands, combosOf } from "../hands";
import { BEGINNER_6MAX, RFI_RANGES } from "./beginner-6max";

/**
 * Share of all 1,326 combinations at which a node takes any voluntary action.
 * This is "how often do I play here", which is what these ranges are really
 * authored against.
 */
function playedPercent(node: ChartNode): number {
  let combos = 0;
  for (const hand of allHands()) {
    const strategy = strategyFor(node, hand);
    const voluntary =
      freqOf(strategy, "call") + freqOf(strategy, "raise") + freqOf(strategy, "allin");
    combos += combosOf(hand) * voluntary;
  }
  return (combos / 1326) * 100;
}

// A `callPercent` helper lived here to police the facing-a-raise flatting
// ranges. Those nodes went in version 3, and nothing opens by calling.

/** Every hand a node does something other than fold with. */
function playedHands(node: ChartNode): Set<string> {
  const played = new Set<string>();
  for (const hand of allHands()) {
    const strategy = strategyFor(node, hand);
    const voluntary =
      freqOf(strategy, "call") +
      freqOf(strategy, "raise") +
      freqOf(strategy, "allin");
    if (voluntary > 0) played.add(hand);
  }
  return played;
}

function find(position: Position, villain?: Position): ChartNode {
  const node = BEGINNER_6MAX.nodes.find(
    (n) => n.key.position === position && n.key.villain === villain,
  );
  if (!node) throw new Error(`missing node: ${position} vs ${villain ?? "unopened"}`);
  return node;
}

const OPENERS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB"];

describe("the chart set as a whole", () => {
  it("covers the openings, the button behind a crowd, and facing a raise", () => {
    // Version 3 dropped fifteen hand-authored facing-a-raise nodes: they were
    // ours rather than the book's, and mixing two authors made "the chart says
    // fold" an ambiguous sentence. Version 5 added the big blind, version 6 the
    // button behind three limpers.
    //
    // Version 9 brings facing a raise back, and the difference is where it
    // comes from: six rules the book actually states, evaluated per seat pair,
    // rather than fifteen ranges someone invented.
    expect(BEGINNER_6MAX.nodes).toHaveLength(52);
    expect(BEGINNER_6MAX.nodes.filter((n) => n.key.scenario === "rfi")).toHaveLength(6);
    expect(
      BEGINNER_6MAX.nodes.filter((n) => n.key.scenario === "vs-limp"),
    ).toHaveLength(1);
    // Fifteen each: every ordered pair of seats where one can raise into the
    // other, then the same pairs the other way round for the re-raises.
    for (const scenario of ["vs-rfi", "vs-3bet", "vs-4bet"]) {
      expect(
        BEGINNER_6MAX.nodes.filter((n) => n.key.scenario === scenario),
        scenario,
      ).toHaveLength(15);
    }
    expect(BEGINNER_6MAX.nodes.filter((n) => n.key.villain)).toHaveLength(45);
  });

  it("gives one answer to facing a raise, not fifteen", () => {
    // The claim the generated nodes make. If these ever diverge it means a rule
    // has started depending on the seats, which at 100bb the book's rules do
    // not — and the drill would be back to teaching fifteen charts.
    const facing = BEGINNER_6MAX.nodes.filter((n) => n.key.scenario === "vs-rfi");
    const shapes = new Set(
      facing.map((node) =>
        allHands()
          .map((hand) => `${hand}:${activeActions(strategyFor(node, hand))[0]}`)
          .join(),
      ),
    );

    expect(facing).toHaveLength(15);
    expect(shapes.size).toBe(1);
  });

  it("plays facing a raise the way the book states it", () => {
    const node = BEGINNER_6MAX.nodes.find((n) => n.key.scenario === "vs-rfi");
    if (!node) throw new Error("no vs-rfi node");

    const byAction = (action: "raise" | "call") =>
      allHands().filter((hand) => freqOf(strategyFor(node, hand), action) > 0);

    // "3-bet for value: AA, KK, AK, QQ."
    expect(byAction("raise")).toEqual(["AA", "KK", "QQ", "AKs", "AKo"]);
    // "Prefer to call: AQ, JJ, TT" — plus every pair, set-mining at 100bb.
    expect(byAction("call")).toEqual([
      "JJ",
      "TT",
      "99",
      "88",
      "77",
      "66",
      "55",
      "44",
      "33",
      "22",
      "AQs",
      "AQo",
    ]);
    // Everything else folds, which is most of it. Note AJ and KQ: they open
    // from every seat and fold to a raise, which is the single biggest
    // difference between opening and facing.
    for (const hand of ["AJs", "AJo", "KQs", "KQo", "A5s", "76s", "72o"]) {
      expect(activeActions(strategyFor(node, hand)), hand).toEqual(["fold"]);
    }
  });

  it("limps behind a crowd on the button without dropping anything", () => {
    const node = BEGINNER_6MAX.nodes.find(
      (n) => n.key.scenario === "vs-limp" && n.key.position === "BTN",
    );
    if (!node) throw new Error("no vs-limp node for the button");

    const limped = Object.entries(node.strategies)
      .filter(([, strategy]) => freqOf(strategy, "call") > 0)
      .map(([hand]) => hand)
      .sort();

    // A3s, 44 and 56s are the book's own pictured examples; A2 and the smaller
    // pairs follow the same "weak, speculative" description.
    expect(limped).toEqual([
      "22",
      "33",
      "44",
      "65s",
      "A2o",
      "A2s",
      "A3o",
      "A3s",
    ]);

    // The same hands are played either way — three of them differently. If this
    // ever drops a hand, the limping rule has quietly become a range change.
    const opening = playedHands(find("BTN"));
    const behind = playedHands(node);
    expect([...opening].filter((hand) => !behind.has(hand))).toEqual([]);
    expect([...behind].filter((hand) => !opening.has(hand))).toEqual([]);
  });

  it("leaves the spots the book does not state uncovered rather than guessing", () => {
    // The silence is the feature, and it keeps moving rather than going away.
    // Version 10 closed the raise-3bet-4bet spine, because the book states a
    // rule for each. It states nothing usable about squeezes or multiway
    // limped pots away from the button, so those stay unmatched and the grader
    // keeps skipping them — a chart that grew a scenario must not start
    // marking its neighbours wrong.
    const covered = new Set(BEGINNER_6MAX.nodes.map((n) => n.key.scenario));
    expect([...covered].sort()).toEqual([
      "rfi",
      "vs-3bet",
      "vs-4bet",
      "vs-limp",
      "vs-rfi",
    ]);
    expect(covered.has("squeeze")).toBe(false);
  });

  it("gives every node a unique id", () => {
    const ids = BEGINNER_6MAX.nodes.map((n) => nodeId(n.key));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("declares itself authored rather than solver-derived", () => {
    // The user is shown this. Claiming solver provenance for hand-authored
    // ranges would teach false confidence, which is worse than teaching nothing.
    expect(BEGINNER_6MAX.provider).toBe("authored");
    expect(BEGINNER_6MAX.notes).toMatch(/not solver output/i);
  });

  it("holds a valid probability distribution for every hand at every node", () => {
    // The check that catches an authoring slip anywhere in twenty hand-written
    // ranges before it can ever teach the wrong thing.
    for (const node of BEGINNER_6MAX.nodes) {
      for (const [hand, strategy] of Object.entries(node.strategies)) {
        const error = strategyError(strategy);
        expect(error, `${nodeId(node.key)} ${hand}: ${error}`).toBeNull();
      }
    }
  });

  it("is pure — no hand mixes two actions", () => {
    for (const node of BEGINNER_6MAX.nodes) {
      for (const [hand, strategy] of Object.entries(node.strategies)) {
        expect(
          activeActions(strategy),
          `${nodeId(node.key)} ${hand} should take exactly one action`,
        ).toHaveLength(1);
      }
    }
  });
});

describe("opening ranges", () => {
  it("widens as position improves", () => {
    // The single most important thing these charts teach. If this ordering ever
    // breaks, the chart is teaching the opposite of the lesson.
    const utg = playedPercent(find("UTG"));
    const hj = playedPercent(find("HJ"));
    const co = playedPercent(find("CO"));
    const btn = playedPercent(find("BTN"));

    expect(utg).toBeLessThan(hj);
    expect(hj).toBeLessThan(co);
    expect(co).toBeLessThan(btn);
  });

  it("opens the small blind tight, not wide", () => {
    // This assertion is the reverse of what it used to be, and the reversal is
    // the point. The previous chart opened the small blind at 31% on the modern
    // argument that only one player is left to act. BlackRain79 treats the
    // blinds as damage control — "my goal is simply to lose the least" — and
    // never states a stealing width at all, calling it player-dependent.
    // Adopting his openers means adopting that, so the small blind is now among
    // the tightest seats on the chart rather than the second widest.
    const sb = playedPercent(find("SB"));
    expect(sb).toBeLessThan(playedPercent(find("CO")));
    expect(sb).toBeLessThan(playedPercent(find("BTN")));
  });

  it("plays the top fifth of hands across the table, as the author asks", () => {
    // "At a 6 player poker table I suggest playing the top 20% of hands that
    // are dealt to you." — BlackRain79's free cheat sheet, page 25. Read from
    // the PDF itself rather than from a summary of it, after a web summariser
    // was caught inventing per-position ranges that document does not contain.
    //
    // This is the only figure he publishes that covers the *whole* chart, and
    // it is therefore the one check no single seat can fake. A future edit that
    // quietly loosens or tightens the set as a whole fails here even when every
    // seat still looks defensible on its own.
    //
    // Averaged over six seats because you sit in each equally often, which is
    // what "hands that are dealt to you" means. The band is wide enough to
    // survive one seat being re-cut, narrow enough to catch drift.
    const seats: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
    const mean =
      seats.reduce((sum, seat) => sum + playedPercent(find(seat)), 0) /
      seats.length;

    expect(mean, `chart plays ${mean.toFixed(1)}% on average`).toBeGreaterThan(
      18,
    );
    expect(mean, `chart plays ${mean.toFixed(1)}% on average`).toBeLessThan(23);
  });

  it("keeps every opening range in a sane band", () => {
    // Widened for version 2. The cutoff and button carry the book's "around 40%
    // of your hands" instruction, far looser than the ranges they replaced,
    // while the early seats carry its "about 12% in 6max".
    //
    // The button's band was 45-62 until version 8, which is what let it sit at
    // 51% while the book said 40%. Narrowed to straddle the stated number, so
    // the band now enforces the instruction instead of tolerating a range that
    // ignored it.
    const bands: Array<[Position, number, number]> = [
      ["UTG", 8, 16],
      ["HJ", 11, 18],
      ["CO", 30, 42],
      ["BTN", 36, 44],
      ["SB", 11, 18],
    ];
    for (const [position, low, high] of bands) {
      const percent = playedPercent(find(position));
      expect(percent, `${position} opens ${percent.toFixed(1)}%`).toBeGreaterThan(low);
      expect(percent, `${position} opens ${percent.toFixed(1)}%`).toBeLessThan(high);
    }
  });

  it("limps only where the book says to limp", () => {
    // This used to assert that nothing ever limps. Version 6 took the book's
    // two limping rules, so the assertion is now about *where*: small pairs
    // under the gun, and nowhere else among the opening spots. What the button
    // limps lives on its own vs-limp node, behind a crowd.
    for (const position of OPENERS) {
      const node = find(position);
      for (const [hand, strategy] of Object.entries(node.strategies)) {
        if (position === "UTG" && freqOf(strategy, "call") > 0) continue;
        expect(
          freqOf(strategy, "call"),
          `${position} should not limp ${hand}`,
        ).toBe(0);
      }
    }
  });

  it("offers every action each node can actually require", () => {
    // The bug this exists to prevent: the drill inferred its buttons from
    // whether there was a raiser, so once the charts began open-limping small
    // pairs it asked "22 under the gun?" while offering only fold and raise,
    // and marked both answers wrong. Every action a node prescribes has to be
    // reachable, or the drill is asking a question it will not accept.
    for (const node of BEGINNER_6MAX.nodes) {
      const offered = offeredActions(node);
      expect(offered, nodeId(node.key)).toContain("fold");

      for (const hand of allHands()) {
        for (const action of activeActions(strategyFor(node, hand))) {
          expect(
            offered,
            `${nodeId(node.key)} needs ${action} for ${hand}`,
          ).toContain(action);
        }
      }
    }
  });

  it("offers the same three buttons at every node", () => {
    // This asserted the reverse until now: that a seat which never calls does
    // not show a call button, on the grounds that an action nobody takes can
    // only be wrong. True about the button, wrong about the drill. Only two of
    // these nodes call, so the button's presence narrowed the spot to one of
    // two seats before the table had been looked at — and with the position
    // labels gone, that was the biggest clue left on the screen. The buttons
    // have to say nothing.
    for (const node of BEGINNER_6MAX.nodes) {
      expect(offeredActions(node), nodeId(node.key)).toEqual([
        "fold",
        "call",
        "raise",
      ]);
    }
  });

  it("open-limps exactly the small pairs under the gun", () => {
    // "At NL2 and NL5 you should limp 22-66 when you are in EP." Under the gun
    // is the one seat where that is unconditional — nobody acts before it, so
    // there is never a raise to face and never a limper to be behind.
    const node = find("UTG");
    const limped = Object.entries(node.strategies)
      .filter(([, strategy]) => freqOf(strategy, "call") > 0)
      .map(([hand]) => hand)
      .sort();

    expect(limped).toEqual(["22", "33", "44", "55", "66"]);
    // Limps rather than mixes: no raise frequency left on them.
    for (const hand of limped) {
      expect(freqOf(strategyFor(node, hand), "raise"), hand).toBe(0);
    }
  });

  it("plays under the gun exactly as the reader dictated it", () => {
    // Written out hand by hand rather than as notation, on purpose. The chart
    // is authored as "77+, AJs+, AJo+, KQs, KQo" plus a 22-66 limp, and the
    // whole question being asked here is whether that notation expands to the
    // hands actually meant. Restating it as notation would test the parser
    // against itself and prove nothing.
    //
    // Dictated, verbatim: "all pairs … ace king suited and unsuited … ace
    // queen suited and unsuited … ace jack suited and unsuited, and … king
    // queen suited and unsuited. With all the pairs from two to six, I call. I
    // don't raise."
    const raised = [
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77",
      "AKs", "AQs", "AJs", "KQs",
      "AKo", "AQo", "AJo", "KQo",
    ];
    const called = ["66", "55", "44", "33", "22"];

    const node = find("UTG");
    const byAction = (action: "raise" | "call") =>
      allHands().filter((hand) => freqOf(strategyFor(node, hand), action) > 0);

    expect(byAction("raise")).toEqual(raised);
    expect(byAction("call")).toEqual(called);

    // And nothing else is in the range at all: every remaining hand folds.
    const played = new Set([...raised, ...called]);
    for (const hand of allHands()) {
      if (played.has(hand)) continue;
      expect(activeActions(strategyFor(node, hand)), hand).toEqual(["fold"]);
    }
  });

  /** Every hand a node plays, with the action, ignoring how it was written. */
  function strategiesOf(node: ChartNode): Array<[string, string]> {
    return allHands()
      .map((hand) => [hand, activeActions(strategyFor(node, hand))[0]] as const)
      .filter(([, action]) => action !== "fold")
      .map(([hand, action]) => [hand, action] as [string, string]);
  }

  it("plays the hijack exactly as the reader dictated it", () => {
    // Dictated, verbatim: "we use the same range, but we add … ace jack suited
    // and unsuited, king queen suited and unsuited, ace ten suited, king jack
    // suited and unsuited, and the jack ten suited."
    //
    // AJ and KQ were already in the under-the-gun range, so the three hands
    // this seat genuinely adds are ATs, KJ both ways, and JTs. What the list
    // does *not* say is the point of writing it out: no ATo, and no JTo.
    const raised = [
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "KQs", "KJs", "JTs",
      "AKo", "AQo", "AJo", "KQo", "KJo",
    ];

    const node = find("HJ");
    const byAction = (action: "raise" | "call") =>
      allHands().filter((hand) => freqOf(strategyFor(node, hand), action) > 0);

    expect(byAction("raise")).toEqual(raised);
    // The limp is scoped to early position by the book, so nothing calls here.
    expect(byAction("call")).toEqual([]);

    const played = new Set(raised);
    for (const hand of allHands()) {
      if (played.has(hand)) continue;
      expect(activeActions(strategyFor(node, hand)), hand).toEqual(["fold"]);
    }
  });

  it("opens both blinds on the middle-position range", () => {
    // Not a coincidence to be re-derived: the book sends the blinds to "similar
    // to the logic behind the EP range... fairly tight, but not quite as tight"
    // and names KQ, ATs and JTs, which is the MP range exactly. They are one
    // string in the source, and this is what says they must stay one.
    const hj = strategiesOf(find("HJ"));
    expect(strategiesOf(find("SB"))).toEqual(hj);
    expect(strategiesOf(find("BB"))).toEqual(hj);
  });

  it("adds hands seat by seat rather than trading them", () => {
    // Each seat acts later than the last, so each range can only grow. A
    // transcription that dropped an earlier hand while adding a later one
    // would look plausible in isolation and would be wrong about the one thing
    // position guarantees.
    //
    // This became load-bearing in version 8. Trimming the button to 40% is only
    // safe while every hand it drops is one the cutoff does not open — cut a
    // hand the cutoff has and the two seats invert, with the button folding
    // what the seat before it raises.
    const played = (position: Position) =>
      new Set(
        allHands().filter(
          (hand) => activeActions(strategyFor(find(position), hand))[0] !== "fold",
        ),
      );

    const ladder: Position[] = ["UTG", "HJ", "CO", "BTN"];
    for (let i = 1; i < ladder.length; i++) {
      const earlier = played(ladder[i - 1]);
      const later = played(ladder[i]);
      for (const hand of earlier) {
        expect(
          later.has(hand),
          `${ladder[i]} drops ${hand}, which ${ladder[i - 1]} opens`,
        ).toBe(true);
      }
      expect(later.size).toBeGreaterThan(earlier.size);
    }
  });

  it("opens the blinds tight like early position, but not quite as tight", () => {
    // Dictated: "the blinds have to be tight, like the early position, but not
    // quite as tight. And if it limps around to me, I should include some
    // hands, like king jack unsuited, ace ten suited, and jack ten suited."
    //
    // "Not quite as tight" is a comparison, so it is tested as one rather than
    // as a number — wider than under the gun, nowhere near late position.
    for (const blind of ["SB", "BB"] as const) {
      const percent = playedPercent(find(blind));
      expect(percent, blind).toBeGreaterThan(playedPercent(find("UTG")));
      expect(percent, blind).toBeLessThan(playedPercent(find("CO")));

      for (const hand of ["KJo", "ATs", "JTs"]) {
        expect(
          activeActions(strategyFor(find(blind), hand))[0],
          `${blind} should play ${hand}`,
        ).not.toBe("fold");
      }
    }
  });

  it("says out loud that the blinds are player-dependent", () => {
    // The book calls this spot player-dependent and never states a width, so
    // the chart prints a number its source does not have. Saying so is not
    // decoration: a study tool that presents its own guess as the book's
    // answer teaches false confidence, which is worse than teaching nothing.
    for (const blind of ["SB", "BB"]) {
      const row = RFI_RANGES.find((r) => r.position === blind);
      expect(row?.caveat, blind).toMatch(/player-dependent/i);
    }
    // And no caveat where the book does give a width.
    for (const stated of ["UTG", "HJ", "CO", "BTN"]) {
      expect(
        RFI_RANGES.find((r) => r.position === stated)?.caveat,
        stated,
      ).toBeUndefined();
    }
  });

  it("keeps every late-position hand the reader named, and none he barred", () => {
    // His list, verbatim: "jack nine unsuited and jack nine suited, queen six
    // suited, seven nine suited, ace four suited, king nine unsuited, and king
    // ten unsuited and king jack unsuited, and seven eight unsuited, and seven
    // eight suited."
    //
    // This is what makes version 8's trim checkable rather than a matter of
    // taste. Narrowing the button by eleven points is only correct if every
    // hand it loses is one he did not ask for.
    const named = [
      "J9o", "J9s", "Q6s", "97s", "A4s", "K9o", "KTo", "KJo", "87o", "87s",
    ];
    // "Do not include really small suited connectors, like two three suited and
    // four five suited … all the stuff that has a high card, which is not an
    // ace or a king and is unsuited and has no kicker, such as queen five
    // unsuited or jack four unsuited. And the whole spectrum of trash, like
    // nine three unsuited and eight two unsuited and ten four unsuited."
    const barred = ["32s", "54s", "Q5o", "J4o", "93o", "82o", "T4o"];

    const node = find("BTN");
    for (const hand of named) {
      expect(
        activeActions(strategyFor(node, hand))[0],
        `BTN should play ${hand}`,
      ).not.toBe("fold");
    }
    for (const hand of barred) {
      expect(
        activeActions(strategyFor(node, hand)),
        `BTN should fold ${hand}`,
      ).toEqual(["fold"]);
    }
  });

  it("opens the button at the width the book states", () => {
    // "Around forty percent of our hands", the reader's instruction, and the
    // book's own figure for late position. Pinned tightly rather than by a
    // band, because this number is the whole reason version 8 exists.
    const btn = playedPercent(find("BTN"));
    expect(btn).toBeGreaterThan(39);
    expect(btn).toBeLessThan(41);
    // And still the widest seat, which was the other half of the instruction.
    expect(btn).toBeGreaterThan(playedPercent(find("CO")));
  });

  it("always opens the best hands and never opens the worst", () => {
    for (const position of OPENERS) {
      const node = find(position);
      for (const premium of ["AA", "KK", "QQ", "AKs", "AKo"]) {
        expect(
          freqOf(strategyFor(node, premium), "raise"),
          `${position} should open ${premium}`,
        ).toBe(1);
      }
      for (const trash of ["72o", "83o", "94o", "32o"]) {
        expect(
          activeActions(strategyFor(node, trash)),
          `${position} should fold ${trash}`,
        ).toEqual(["fold"]);
      }
    }
  });
});

describe("facing an open", () => {
  it("three-bets the premiums everywhere and folds the trash everywhere", () => {
    // Scoped to vs-rfi. It used to run over every node carrying a villain,
    // which was the same set until version 10 — and would now assert that AK
    // three-bets over a *four*-bet, where the book folds it. Trash still folds
    // in all three, so that half stays broad.
    for (const node of BEGINNER_6MAX.nodes.filter(
      (n) => n.key.scenario === "vs-rfi",
    )) {
      const where = nodeId(node.key);
      for (const premium of ["AA", "KK", "AKs"]) {
        expect(
          freqOf(strategyFor(node, premium), "raise"),
          `${where} should three-bet ${premium}`,
        ).toBe(1);
      }
    }

    for (const node of BEGINNER_6MAX.nodes.filter((n) => n.key.villain)) {
      for (const trash of ["72o", "83o"]) {
        expect(
          activeActions(strategyFor(node, trash)),
          `${nodeId(node.key)} should fold ${trash}`,
        ).toEqual(["fold"]);
      }
    }
  });

  it("gets tighter the more times the pot has been raised", () => {
    // The spine of the whole facing tree, and the thing a reader most needs to
    // feel: each extra raise in front of you strictly narrows what continues.
    // If this ever inverts, some scenario has been authored looser than the one
    // before it and the drill is teaching the opposite of the lesson.
    const played = (scenario: string) => {
      const node = BEGINNER_6MAX.nodes.find((n) => n.key.scenario === scenario);
      if (!node) throw new Error(`no ${scenario} node`);
      return allHands().filter(
        (hand) => activeActions(strategyFor(node, hand))[0] !== "fold",
      );
    };

    const open = played("rfi").length;
    const vsRaise = played("vs-rfi").length;
    const vs3bet = played("vs-3bet").length;
    const vs4bet = played("vs-4bet").length;

    expect(vsRaise).toBeLessThan(open);
    expect(vs3bet).toBeLessThan(vsRaise);
    expect(vs4bet).toBeLessThan(vs3bet);
    // Two hands. Everything else goes in the muck.
    expect(vs4bet).toBe(2);
  });

  it("plays facing a 3-bet and a 4-bet the way the book states", () => {
    const node = (scenario: string) => {
      const found = BEGINNER_6MAX.nodes.find(
        (n) => n.key.scenario === scenario,
      );
      if (!found) throw new Error(`no ${scenario} node`);
      return found;
    };
    const byAction = (scenario: string, action: "raise" | "call") =>
      allHands().filter(
        (hand) => freqOf(strategyFor(node(scenario), hand), action) > 0,
      );

    // "AA and KK only in full ring. Add AK, QQ, JJ routinely in 6-max."
    expect(byAction("vs-3bet", "raise")).toEqual([
      "AA",
      "KK",
      "QQ",
      "JJ",
      "AKs",
      "AKo",
    ]);
    // "Call with roughly 88+ and AQ/AK — and the top of that is 4-betting."
    expect(byAction("vs-3bet", "call")).toEqual(["TT", "99", "88", "AQs", "AQo"]);

    // "Fold the large majority of the time. Kings are never a fold at 100bb."
    expect(byAction("vs-4bet", "raise")).toEqual(["AA", "KK"]);
    expect(byAction("vs-4bet", "call")).toEqual([]);
    // The hands it feels wrong to fold, and the discipline the book asks for.
    for (const hand of ["QQ", "JJ", "AKs", "AKo", "AQs"]) {
      expect(
        activeActions(strategyFor(node("vs-4bet"), hand)),
        `vs-4bet should fold ${hand}`,
      ).toEqual(["fold"]);
    }
  });

  it("never calls with a hand it would three-bet", () => {
    // Enforced at construction, but asserted here so a future edit that
    // introduces an overlap fails loudly rather than silently resolving it.
    for (const node of BEGINNER_6MAX.nodes) {
      for (const [hand, strategy] of Object.entries(node.strategies)) {
        const both = freqOf(strategy, "raise") > 0 && freqOf(strategy, "call") > 0;
        expect(both, `${nodeId(node.key)} ${hand} is both a raise and a call`).toBe(
          false,
        );
      }
    }
  });
});

describe("money in front of each seat", () => {
  it("posts the blinds when nobody has raised", () => {
    expect(wagerBb("SB", undefined, BEGINNER_6MAX)).toBe(0.5);
    expect(wagerBb("BB", undefined, BEGINNER_6MAX)).toBe(1);
  });

  it("leaves every other seat with nothing in front of it", () => {
    for (const seat of ["UTG", "HJ", "CO", "BTN"] as Position[]) {
      expect(wagerBb(seat, undefined, BEGINNER_6MAX)).toBeNull();
    }
  });

  it("shows the raiser's total, not the raise on top of a blind", () => {
    // The small blind opening is the case that catches this: it has already
    // posted 0.5, and a raise *to* 3 means 3 in front of it, not 3.5. Adding
    // would be silently wrong — the number would simply look plausible.
    expect(wagerBb("SB", "SB", BEGINNER_6MAX)).toBe(3);
  });

  it("opens larger from the small blind than from anywhere else", () => {
    expect(openSizeBb(BEGINNER_6MAX, "SB")).toBe(3);
    for (const seat of ["UTG", "HJ", "CO", "BTN"] as Position[]) {
      expect(openSizeBb(BEGINNER_6MAX, seat)).toBe(2.5);
    }
  });

  it("still posts the blinds when someone else raised", () => {
    expect(wagerBb("SB", "CO", BEGINNER_6MAX)).toBe(0.5);
    expect(wagerBb("BB", "CO", BEGINNER_6MAX)).toBe(1);
    expect(wagerBb("CO", "CO", BEGINNER_6MAX)).toBe(2.5);
  });

  it("still knows what the small blind opens to", () => {
    // No node depends on this any more — the facing-a-raise ranges that were
    // authored against a 3x open are gone. It stays because the table draws
    // the raiser's chips from it, and a wrong number there is visible.
    expect(openSizeBb(BEGINNER_6MAX, "SB")).toBe(3);
  });
});
