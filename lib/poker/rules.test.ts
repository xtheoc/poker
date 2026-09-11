import { describe, expect, it } from "vitest";
import {
  FOUR_BET,
  type Position,
  THREE_BET_IP,
  THREE_BET_OOP,
  activeActions,
  isInPosition,
  strategyFor,
  wagersFor,
} from "./charts";
import { BEGINNER_6MAX } from "./charts/beginner-6max";
import { allHands } from "./hands";
import {
  type Rule,
  type RuleSpot,
  actionFor,
  decide,
  nodeFromRules,
  ruleFor,
} from "./rules";
import {
  SET_MINE_BB,
  SET_MINE_OOP_BB,
  SQUEEZE_RULES,
  VS_OPEN_RULES,
} from "./rules/preflop";

function spot(over: Partial<RuleSpot> = {}): RuleSpot {
  return {
    scenario: "vs-rfi",
    position: "BTN",
    villain: "CO",
    hand: "72o",
    stackBb: 100,
    inPosition: true,
    ...over,
  };
}

describe("who is in position", () => {
  it("reads the postflop order, not the preflop one", () => {
    // The trap this exists for: the small blind acts before the button preflop
    // and after it on every later street. Comparing seats in preflop order
    // would call the small blind "in position" against most of the table, and
    // the set-mining rule would then use the looser stack threshold in the
    // worst seat at the table.
    expect(isInPosition("SB", "BTN")).toBe(false);
    expect(isInPosition("BTN", "SB")).toBe(true);
    expect(isInPosition("BB", "UTG")).toBe(false);
    expect(isInPosition("UTG", "BB")).toBe(true);
    expect(isInPosition("CO", "HJ")).toBe(true);
  });

  it("puts the button in position on everyone", () => {
    const seats: Position[] = ["UTG", "HJ", "CO", "SB", "BB"];
    for (const seat of seats) {
      expect(isInPosition("BTN", seat), `BTN vs ${seat}`).toBe(true);
      expect(isInPosition(seat, "BTN"), `${seat} vs BTN`).toBe(false);
    }
  });
});

describe("the rule engine", () => {
  const first: Rule = {
    id: "first",
    scenario: "vs-rfi",
    cite: "x",
    summary: "x",
    when: () => true,
    then: "raise",
  };
  const second: Rule = { ...first, id: "second", then: "call" };

  it("takes the first rule that claims a spot", () => {
    // Order is the argument. The playbook reads as a default with exceptions
    // stacked above it, and first-match is what preserves that in code.
    expect(decide([first, second], spot())?.rule.id).toBe("first");
    expect(decide([second, first], spot())?.rule.id).toBe("second");
  });

  it("ignores rules belonging to another scenario", () => {
    const elsewhere: Rule = { ...first, id: "elsewhere", scenario: "vs-3bet" };
    expect(decide([elsewhere], spot())).toBeNull();
  });

  it("falls back to folding when nothing matches", () => {
    // Null is not an error — it is how a ruleset says "the default applies".
    expect(decide([], spot())).toBeNull();
    expect(actionFor([], spot())).toBe("fold");
  });

  it("holds back rules that need a read unless asked", () => {
    // The load-bearing safety property. A generated node has no opponent
    // attached, so a rule conditioned on one must not fire there: being marked
    // wrong for failing to make a read the app cannot see is worse than the
    // spot going ungraded.
    const read: Rule = { ...first, id: "read", needsRead: true };
    expect(decide([read], spot())).toBeNull();
    expect(decide([read], spot(), { useReads: true })?.rule.id).toBe("read");
  });
});

describe("generating a node from rules", () => {
  const key = {
    scenario: "vs-rfi" as const,
    position: "BTN" as const,
    villain: "CO" as const,
    stackBb: 100,
    treeId: "test",
  };

  it("asks every hand and stores only what it plays", () => {
    const node = nodeFromRules(VS_OPEN_RULES, key);

    // Sparse, exactly like an authored chart: an absent hand folds.
    expect(node.strategies["72o"]).toBeUndefined();
    expect(activeActions(strategyFor(node, "72o"))).toEqual(["fold"]);
    expect(activeActions(strategyFor(node, "AA"))).toEqual(["raise"]);
    expect(activeActions(strategyFor(node, "77"))).toEqual(["call"]);
  });

  it("produces a pure strategy for every hand it plays", () => {
    const node = nodeFromRules(VS_OPEN_RULES, key);
    for (const hand of allHands()) {
      expect(activeActions(strategyFor(node, hand)).length, hand).toBe(1);
    }
  });

  it("hands back the sentence behind an answer, not just the answer", () => {
    // Being told "fold" teaches nothing. Being told which rule folded it is
    // the reason grading against a book beats grading against a solver.
    expect(ruleFor(VS_OPEN_RULES, key, "AA")?.id).toBe("vs-open/3bet-value");
    expect(ruleFor(VS_OPEN_RULES, key, "JJ")?.id).toBe("vs-open/flat-strong");
    expect(ruleFor(VS_OPEN_RULES, key, "44")?.id).toBe("vs-open/set-mine");
    expect(ruleFor(VS_OPEN_RULES, key, "72o")?.id).toBe("vs-open/fold");
  });
});

describe("the money on the table", () => {
  const find = (scenario: string) => {
    const node = BEGINNER_6MAX.nodes.find((n) => n.key.scenario === scenario);
    if (!node) throw new Error(`no ${scenario} node`);
    return node;
  };

  it("posts the blinds and nothing else in an unopened pot", () => {
    const wagers = wagersFor(find("rfi"), BEGINNER_6MAX);
    expect(wagers.get("SB")).toBe(0.5);
    expect(wagers.get("BB")).toBe(1);
    expect(wagers.get("CO")).toBeUndefined();
  });

  it("shows only the raiser's chips when facing an open", () => {
    const node = find("vs-rfi");
    const wagers = wagersFor(node, BEGINNER_6MAX);
    const villain = node.key.villain;
    if (!villain) throw new Error("vs-rfi node has no villain");

    expect(wagers.get(villain)).toBe(
      villain === "SB" ? BEGINNER_6MAX.sbOpenBb : BEGINNER_6MAX.openBb,
    );
    // The hero has done nothing yet beyond any blind he posted.
    const hero = node.key.position;
    if (hero !== "SB" && hero !== "BB") {
      expect(wagers.get(hero)).toBeUndefined();
    }
  });

  it("shows your own open under their 3-bet", () => {
    // Without this the table would draw a 3-bet exactly like a large open, and
    // the two are completely different decisions.
    const node = find("vs-3bet");
    const wagers = wagersFor(node, BEGINNER_6MAX);
    const hero = node.key.position;
    const villain = node.key.villain;
    if (!villain) throw new Error("vs-3bet node has no villain");

    const open = hero === "SB" ? BEGINNER_6MAX.sbOpenBb : BEGINNER_6MAX.openBb;
    expect(wagers.get(hero)).toBe(open);
    // Three times in position, four out of it.
    const times = isInPosition(villain, hero) ? THREE_BET_IP : THREE_BET_OOP;
    expect(wagers.get(villain)).toBe(open * times);
  });

  it("stacks the 4-bet on top of your 3-bet", () => {
    const node = find("vs-4bet");
    const wagers = wagersFor(node, BEGINNER_6MAX);
    const hero = node.key.position;
    const villain = node.key.villain;
    if (!villain) throw new Error("vs-4bet node has no villain");

    // The villain opened, so the hero is the one who 3-bet.
    const open =
      villain === "SB" ? BEGINNER_6MAX.sbOpenBb : BEGINNER_6MAX.openBb;
    const times = isInPosition(hero, villain) ? THREE_BET_IP : THREE_BET_OOP;
    const threeBet = open * times;

    // Rounded to the half blind, because that is the smallest chip on the
    // table and "18.75" is not a number anyone types into a raise box.
    const chips = (value: number) => Math.round(value * 2) / 2;

    expect(wagers.get(hero)).toBe(chips(threeBet));
    expect(wagers.get(villain)).toBe(chips(threeBet * FOUR_BET));
    // And it is genuinely bigger than what it answers, which is the one way
    // this arithmetic could be wrong and still look plausible on screen.
    expect(wagers.get(villain)!).toBeGreaterThan(wagers.get(hero)!);
  });

  it("puts a blind in front of every limper", () => {
    const wagers = wagersFor(find("vs-limp"), BEGINNER_6MAX);
    for (const seat of ["UTG", "HJ", "CO"] as const) {
      expect(wagers.get(seat), seat).toBe(1);
    }
  });

  it("shows the open and every cold caller before a squeeze", () => {
    const node = BEGINNER_6MAX.nodes.find(
      (candidate) =>
        candidate.key.scenario === "squeeze" &&
        candidate.key.position === "BB" &&
        candidate.key.villain === "UTG" &&
        candidate.key.callers?.join(",") === "HJ,CO",
    );
    if (!node) throw new Error("missing BB squeeze over UTG/HJ/CO");

    const wagers = wagersFor(node, BEGINNER_6MAX);
    expect(wagers.get("UTG")).toBe(BEGINNER_6MAX.openBb);
    expect(wagers.get("HJ")).toBe(BEGINNER_6MAX.openBb);
    expect(wagers.get("CO")).toBe(BEGINNER_6MAX.openBb);
  });
});

describe("facing a raise", () => {
  it("3-bets only the top four hands", () => {
    const raising = allHands().filter(
      (hand) => actionFor(VS_OPEN_RULES, spot({ hand })) === "raise",
    );
    expect(raising).toEqual(["AA", "KK", "QQ", "AKs", "AKo"]);
  });

  it("folds the hands you opened with from every seat", () => {
    // The biggest gap between opening and facing, and the one most likely to
    // cost money: AJ and KQ open from all six seats and are folds the moment
    // somebody raises.
    for (const hand of ["AJs", "AJo", "KQs", "KQo", "KJs", "ATs"]) {
      expect(actionFor(VS_OPEN_RULES, spot({ hand })), hand).toBe("fold");
    }
  });

  it("set-mines every pair the value range does not already take", () => {
    const pairs = allHands().filter((hand) => hand.length === 2);
    for (const hand of pairs) {
      const expected =
        hand === "AA" || hand === "KK" || hand === "QQ" ? "raise" : "call";
      expect(actionFor(VS_OPEN_RULES, spot({ hand })), hand).toBe(expected);
    }
  });

  it("stops set-mining when there is not enough behind", () => {
    // 15:1 on their stack, which the book puts at roughly 50bb — and 70bb out
    // of position, because a check-behind kills the check-raise the call was
    // made for. A short stack turns these into folds, not cheap flops.
    const ip = { hand: "44" };
    expect(actionFor(VS_OPEN_RULES, spot({ ...ip, stackBb: SET_MINE_BB }))).toBe(
      "call",
    );
    expect(
      actionFor(VS_OPEN_RULES, spot({ ...ip, stackBb: SET_MINE_BB - 1 })),
    ).toBe("fold");

    const oop = { hand: "44", inPosition: false, position: "BB" as const };
    expect(
      actionFor(VS_OPEN_RULES, spot({ ...oop, stackBb: SET_MINE_OOP_BB })),
    ).toBe("call");
    // Enough in position, not enough out of it. This is the whole reason the
    // two thresholds exist.
    expect(actionFor(VS_OPEN_RULES, spot({ ...oop, stackBb: SET_MINE_BB }))).toBe(
      "fold",
    );
  });

  it("keeps the read-dependent exceptions out of the default answer", () => {
    // 67s with a fish in the pot is a call; 67s otherwise is a fold. Both are
    // the book. Only the second can be graded without knowing who is in the
    // pot, so only the second is the default.
    const speculative = spot({ hand: "67s" });
    expect(actionFor(VS_OPEN_RULES, speculative)).toBe("fold");
    expect(
      actionFor(
        VS_OPEN_RULES,
        { ...speculative, fishInPot: true },
        { useReads: true },
      ),
    ).toBe("call");

    // A light 3-bet needs both halves: position, and someone folding too much.
    const light = spot({ hand: "K5o", foldsTooMuch: true });
    expect(actionFor(VS_OPEN_RULES, light)).toBe("fold");
    expect(actionFor(VS_OPEN_RULES, light, { useReads: true })).toBe("raise");
    expect(
      actionFor(VS_OPEN_RULES, { ...light, inPosition: false }, { useReads: true }),
    ).toBe("fold");
  });

  it("never calls a speculative hand from the blinds, fish or not", () => {
    // "Fold them from the blinds regardless of who is in — you want position
    // at all costs with these." Out of position the exception cannot fire.
    const blind = spot({
      position: "BB",
      villain: "CO",
      inPosition: false,
      hand: "67s",
      fishInPot: true,
    });
    expect(actionFor(VS_OPEN_RULES, blind, { useReads: true })).toBe("fold");
  });
});

describe("squeezing", () => {
  it("keeps the automatic range value-first, with the sourced BB/JJ exception", () => {
    const squeeze = (hand: RuleSpot["hand"], callers: number, position: Position = "BB") =>
      actionFor(
        SQUEEZE_RULES,
        spot({ scenario: "squeeze", hand, callers, position, villain: "UTG", inPosition: false }),
      );

    expect(squeeze("QQ", 1)).toBe("raise");
    expect(squeeze("AKo", 1)).toBe("raise");
    expect(squeeze("JJ", 2)).toBe("raise");
    expect(squeeze("JJ", 1)).toBe("fold");
    expect(squeeze("AJs", 2)).toBe("fold");
  });
});
