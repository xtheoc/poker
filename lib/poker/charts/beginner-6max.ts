/**
 * The beginner chart set: 6-max, 100bb, 2.5x opens.
 *
 * **Provenance, stated plainly because the user is shown it too.** These ranges
 * are hand-authored from published aggregate frequencies. They are not solver
 * output and are not claimed to be. There is no openly-licensed, solver-accurate
 * 6-max preflop dataset in existence — every accurate set is paywalled, and the
 * popular free repositories are re-typings of paywalled PDFs published under
 * licences their authors had no right to grant. Rather than launder someone
 * else's work, this set is written from scratch and owned outright.
 *
 * **Why pure strategies.** Every hand here is 100% one action. A real solution
 * mixes — it might open a hand 63% of the time — but a mixed chart is
 * unlearnable for a beginner, and at NL2 the difference is worth a rounding
 * error next to the errors opponents are making. Learning one clear rule and
 * following it beats approximating a frequency badly. The data structure still
 * carries frequency and EV per action, so a solver-derived set replaces this one
 * without touching a line of code elsewhere.
 *
 * **Why these are slightly tight.** Wide ranges are only profitable if you play
 * well postflop, which is the thing a beginner is worst at. A tight range is
 * more forgiving of postflop mistakes, and the money at NL2 comes from opponents
 * playing far too many hands rather than from squeezing the last 2% out of an
 * opening range. This loosens as the skill state rises, not before.
 *
 * **The tree.** One convention, covered completely: 2.5x opens from every seat
 * except the small blind, which opens 3x and never limps. A complete single
 * tree beats a patchy multi-tree library for a memorisation product.
 */

import {
  type ChartNode,
  type ChartSet,
  type NodeKey,
  POSITIONS,
  type Position,
  type Strategy,
} from "../charts";
import { type Hand, parseRange } from "../hands";
import { nodeFromRules } from "../rules";
import {
  SQUEEZE_RULES,
  VS_3BET_RULES,
  VS_4BET_RULES,
  VS_OPEN_RULES,
} from "../rules/preflop";

export const TREE_ID = "6max-2.5x";
export const STACK_BB = 100;

/**
 * Turn named ranges into a node's sparse strategy map.
 *
 * Hands appearing in neither range are omitted, which is how the chart says
 * "fold". A hand appearing in *both* is an authoring error rather than a mixed
 * strategy — this set is pure by design — so it throws rather than silently
 * picking one.
 */
function node(key: NodeKey, spec: { raise?: string; call?: string }): ChartNode {
  const strategies: Record<Hand, Strategy> = {};

  if (spec.call) {
    for (const hand of parseRange(spec.call).keys()) {
      strategies[hand] = { call: { freq: 1 } };
    }
  }

  if (spec.raise) {
    for (const hand of parseRange(spec.raise).keys()) {
      if (strategies[hand]) {
        throw new Error(
          `${key.position} vs ${key.villain ?? "unopened"}: ${hand} is in both the raise and call range`,
        );
      }
      strategies[hand] = { raise: { freq: 1 } };
    }
  }

  return { key, strategies };
}

function rfi(position: Position, raise: string, call?: string): ChartNode {
  return node(
    { scenario: "rfi", position, stackBb: STACK_BB, treeId: TREE_ID },
    { raise, call },
  );
}

// A `vsRfi` helper lived here until version 3. The fifteen facing-a-raise
// nodes it built were ours rather than the book's, and mixing two authors'
// opinions in one chart made "the chart says fold" an ambiguous sentence.
// They are in git if the book's later chapter ever justifies bringing them
// back — with its numbers rather than ours.

/**
 * Opening ranges, unopened pot. **BlackRain79's, not ours.**
 *
 * Version 2 replaced the hand-authored openers with the starting-hand ranges
 * from *Crushing The Microstakes*, at the reader's request. Two conventions
 * from the book govern the transcription, and both change what the ranges hold:
 *
 * **An `o` suffix means both ways.** The book's Note #2 states that "K8o+"
 * covers "all suited and offsuit variations of a king above this", so `K8o+`
 * becomes `K8s+, K8o+` here. An `s` suffix still means suited only — the chart
 * proves the two differ by listing `ATo+` and `A8s+` on one row, which would be
 * redundant otherwise.
 *
 * **Gapper ladders are written out.** The book's `75s+` means 75s, 86s, 97s and
 * upward. This codebase's parser reads a non-connector `+` as *raising the
 * kicker*, so `75s+` would be 75s and 76s — and that meaning cannot be changed
 * without silently rewriting the vs-RFI ranges below, which were authored
 * against it. So the ladders are enumerated instead of abbreviated.
 *
 * The ordering these teach is the book's, and it is not the one the previous
 * chart taught: the cutoff and button open enormously, and **the small blind is
 * tight rather than wide**. That follows from the book treating the blinds as
 * damage control — "my goal is simply to lose the least" — rather than as the
 * second-best stealing seat at the table.
 */
/**
 * The openers as written, in table order.
 *
 * Exported so a study view can show the notation that was actually authored
 * rather than a reconstruction of it. Recomputing this from the expanded
 * strategies would mean writing a compressor, and a compressor with a bug
 * would quietly show you a range you are not being graded against — which is
 * precisely the thing you would be reading it to check.
 *
 * The nodes are built from this list, so the two cannot drift.
 */
/**
 * Middle position's range, named because three seats are defined as being it.
 *
 * Both blinds are documented below as "the MP range", on the book's own
 * instruction, and while that was written out three times it was three strings
 * that could drift apart without anything noticing. Narrowing the hijack's AT
 * and JT to suited is exactly the edit that would have done it. One constant
 * makes the claim structural instead of a comment.
 */
const MP_RANGE = "22+, ATs+, AJo+, KJs+, KJo+, JTs";

export const RFI_RANGES: ReadonlyArray<{
  position: Position;
  notation: string;
  /** Hands played by limping rather than raising, where the book says so. */
  limp?: string;
  /**
   * A width this chart states more confidently than its source does.
   *
   * Shown wherever the range is shown. The blinds are the honest case for it:
   * the book calls their width player-dependent and never gives a number, so a
   * chart that prints one and stays silent about that teaches a confidence the
   * source does not have. This project is built against exactly that failure —
   * a tool that invents certainty is worse than one that says where it stops.
   */
  caveat?: string;
}> = [
  // The book's "EP", which in 6-max is the first seat to act. All pairs, plus
  // AK/AQ, plus the two hands it adds for 6-max: AJ and KQ.
  //
  // 10.7% of hands against the book's stated 12%, which is as close as its own
  // rounding allows: all pairs is 78 combos and four both-way broadways is 64,
  // so no reading of this list reaches 12% exactly.
  //
  // The small pairs limp rather than raise. That is a stakes-specific rule
  // rather than a range change — "at NL2 and NL5 you should limp 22-66 when
  // you are in EP" — and it belongs here because under the gun is the one seat
  // where it is unconditional: nobody can have acted before it, so there is
  // never a raise to face and never a limper to be behind.
  {
    position: "UTG",
    notation: "77+, AJs+, AJo+, KQs, KQo",
    limp: "22-66",
  },

  // The book's "MP" — "the 2nd person to act preflop in 6max". Its own words:
  // the EP range plus "a few more hands in 6max such as" AT, KJ and JT.
  //
  // Taken from the prose rather than from the chart, at the reader's direction.
  // The chart's HJ row is wider — it adds QJ, A8s-A9s and the suited-connector
  // ladder from 78s up — and the two cannot both be right. The prose gives its
  // reasoning, so the prose wins.
  //
  // **AT and JT are suited only. KJ goes both ways.** Version 6 had all three
  // both ways: the prose writes them bare — "AT, KJ and JT" — with no suffix
  // for Note #2 to apply to, so they were read as the book's usual both-way
  // shorthand. The reader then dictated the range back hand by hand and drew
  // the line differently: "ace ten suited … king jack suited and unsuited, and
  // the jack ten suited". Version 7 takes his reading. The distinction is
  // consistent within one breath rather than a slip, and the two hands it
  // removes — ATo and JTo — are the most easily dominated in the group, which
  // is the direction in which a beginner's mistake costs the most.
  //
  // The pairs all still raise from here. The 22-66 limp is scoped to EP by the
  // book — "when you are in EP" — so "the same range as under the gun" carries
  // the hands over, not the limp.
  { position: "HJ", notation: MP_RANGE },

  // The book's "LP", which it says should be "around 40% of your hands" and
  // then declines to list, calling the range "too long". So the cutoff and the
  // button come from the chart, which does enumerate them.
  //
  // Chart row: 22+, all aces, all broadways, K8o+, Q9o+, J8o+, 56s+, 75s+.
  {
    position: "CO",
    notation:
      "22+, A2s+, A2o+, K8s+, K8o+, Q9s+, Q9o+, J8s+, J8o+, " +
      // 56s+ connectors and the 75s+ one-gapper ladder, longhand.
      "56s, 67s, 78s, 89s, T9s, 75s, 86s, 97s, T8s",
  },

  // Chart row: 22+, all aces, all broadways, all kings, Q7o+, J8o+, T8o+,
  // 56s+, 64s+, 74s+.
  //
  // Taken whole, that row lands at 51%, well wider than the book's own "around
  // 40%" and its rule of thumb that late position plays "3 times as many hands
  // as EP". Versions 4 to 7 kept the row and treated the 40% as the loose
  // estimate it reads like.
  //
  // **Version 8 reverses that, at the reader's direction: the number wins.**
  // Asked which to grade against, he chose "keep the button wider but still
  // modify the range so the button plays 40 percent of hands". Both readings
  // are the book's, and it is his study tool; a chart he does not believe is a
  // chart he will argue with instead of learning.
  //
  // Three constraints decided *which* hands went, so this is a trim rather than
  // a rewrite:
  //
  //   1. Only hands the cutoff does not also open. That is what keeps the
  //      button the widest seat at the table, which was his other condition,
  //      and it is the one fact about position no chart may contradict.
  //   2. Never a hand the prose names. Q6s, 87o, 97s, A4s, K9o, KTo, KJo, J9o,
  //      J9s and 87s all survive.
  //   3. Weakest first. That takes the offsuit and suited kings below K8 — the
  //      exact "all kings" the row's wording turns on — then Q8o and Q7o, which
  //      sit nearest the book's own Q5o example of junk, then T8o, then the
  //      two-gapper ladder 74s/85s/96s/T7s.
  //
  // Lands at 40.3%, against the cutoff's 36.4%. Note that 40% and "3 times EP"
  // cannot both hold: this set's early position computes to 10.7%, so 40% is
  // 3.8x it. The explicit percentage is the one being hit.
  //
  // The junk rule still reads the way it always did — "all the stuff that has a
  // high card (which is not an ace or a king), is unsuited and has no kicker"
  // — and unsuited ace-x stays, since that carve-out is only meaningful if it
  // is in the range. The other exclusions check out: 32s and 54s are pitched,
  // Q5o and J4o fall outside Q9o+ and J8o+, and 93o/82o/T4o never appear.
  //
  // Two hands are here that the chart row alone would exclude. The prose lists
  // six example holdings it "regularly opens" from the cutoff and button, and
  // four of them already sat inside the row — J9o, 97s, A4s, K9s. The other two
  // did not: **Q6s**, below the row's Q7 threshold, and **87o**, which the row
  // has no token for at all. The same paragraph promises "a whole host of other
  // suited and unsuited high card strength and connecting type hands", so an
  // offsuit connector belonging here is the prose's own claim rather than an
  // inference.
  //
  // Q7s+ therefore becomes Q6s+, and 98o joins 87o so the offsuit connectors
  // run unbroken up to the T9o the row already had — a range with 87o and T9o
  // but no 98o would be an artefact of transcription, not a strategy.
  //
  // Left on the button only. Applying them to the cutoff would mean inventing
  // Q7s and Q8s to bridge its Q9 threshold, and the chart deliberately gives
  // the two seats different thresholds.
  {
    position: "BTN",
    notation:
      "22+, A2s+, A2o+, K8s+, K8o+, Q6s+, Q9o+, J8s+, J8o+, T8s+, T9o, " +
      // 56s+ connectors and the 64s+ one-gappers, longhand. The two-gapper
      // ladder went with version 8's trim.
      "56s, 67s, 78s, 89s, 64s, 75s, 86s, 97s, " +
      // The two hands the prose names that the chart row leaves out. See below.
      "87o, 98o",
  },

  // The small blind is the one seat the book never gives an opening range for.
  //
  // Its blinds chapter is mostly about completing behind limpers, and the one
  // sentence about opening a folded pot says to "attempt to steal with a
  // reasonably wide range. Not too wide though" — and then that the right width
  // "will be player dependent", wider against a nit in the big blind, tighter
  // against a three-betting TAG. That is a real answer, and not one a fixed
  // chart can hold.
  //
  // So this follows the book's instruction for the blinds as a whole —
  // "similar to the logic behind the EP range... fairly tight, but not quite as
  // tight" — and reads the extra hands it names there (KQ, ATs, JTs) as landing
  // exactly on the MP range. Which is what this is: the HJ range above.
  //
  // Those three named hands are also the strongest evidence in the book for
  // version 7's narrowing of AT and JT to suited. The blinds chapter writes
  // them with the suffix — **ATs** and **JTs** — where the MP prose writes them
  // bare, and it is naming the same group of added broadways. The reader's
  // reading and the book's own notation agree.
  //
  // Deliberately the tightest defensible reading. The alternative was to invent
  // a width the book never states, and a chart that grades you against an
  // invented number is worse than one that admits where it stops.
  {
    position: "SB",
    notation: MP_RANGE,
    caveat:
      "Player-dependent — the book never states a width here. Open wider " +
      "against a big blind that folds too much; tighten against one that " +
      "calls or three-bets you.",
  },

  // The big blind, and only when the pot has been limped to it.
  //
  // Folded round is not a decision: everyone passed, the blind wins, nobody
  // acts. Limped to is a decision, and it is the one the book's blinds chapter
  // actually addresses — "when the pot is limped around you should complete
  // from the SB, or **raise from either blind**, with a few more speculative
  // and high card type hands", naming KQ, ATs and JTs.
  //
  // Those three land on the MP range exactly as they did for the small blind,
  // so this is that range again. Checking the option is graded as declining to
  // raise, which is what it is: preflop the only question a chart asks is
  // whether to commit chips.
  {
    position: "BB",
    notation: MP_RANGE,
    caveat:
      "Only reached when the pot is limped to you — folded round, the blind " +
      "is already yours and there is nothing to decide. Player-dependent in " +
      "the same way the small blind is.",
  },
];

/**
 * Facing a single raise — every seat pair it can happen in.
 *
 * Generated from `VS_OPEN_RULES` rather than authored. Fifteen nodes, one per
 * (opener, hero) pair the six-max order allows, and at 100bb all fifteen carry
 * the same strategy, because the book's answer does not depend on the seats.
 * Worth showing rather than collapsing: a drill that asks the same question
 * from fifteen angles and accepts the same answer is how you learn there is one
 * rule here rather than fifteen charts.
 *
 * `decisions.ts` has been stamping imported hands with exactly these node ids
 * since it learned to recognise a single raise. Until now nothing matched them,
 * so every hand where somebody raised into the reader counted as uncharted.
 */
const RESPONSE_STACKS = [50, STACK_BB] as const;

const VS_OPEN_NODES: ChartNode[] = RESPONSE_STACKS.flatMap((stackBb) =>
  POSITIONS.flatMap((villain, opener) =>
    POSITIONS.slice(opener + 1).map((position) =>
      nodeFromRules(VS_OPEN_RULES, {
        scenario: "vs-rfi",
        position,
        villain,
        stackBb,
        treeId: TREE_ID,
      }),
    ),
  ),
);

/**
 * Open, at least one cold call, then the hero re-raises.
 *
 * The caller seats are preserved in the node identity rather than collapsed to
 * a count. They let the visual drill show the actual dead money and prevent a
 * BB spot over UTG/BTN from masquerading as UTG/HJ/SB. The rule only currently
 * distinguishes the author’s exact two-caller BB/JJ example; the rest share a
 * tight value baseline, but they remain distinct situations for future rules.
 */
const SQUEEZE_NODES: ChartNode[] = RESPONSE_STACKS.flatMap((stackBb) =>
  POSITIONS.flatMap((villain, opener) =>
    POSITIONS.slice(opener + 2).flatMap((position, heroIndex) => {
      const hero = opener + 2 + heroIndex;
      const between = POSITIONS.slice(opener + 1, hero);
      const callerSets = subsets(between);
      return callerSets.map((callers) =>
        nodeFromRules(SQUEEZE_RULES, {
          scenario: "squeeze",
          position,
          villain,
          callers,
          stackBb,
          treeId: TREE_ID,
        }),
      );
    }),
  ),
);

/** Every non-empty caller combination between the opener and hero. */
function subsets(seats: readonly Position[]): Position[][] {
  const sets: Position[][] = [];
  for (let mask = 1; mask < 1 << seats.length; mask++) {
    sets.push(seats.filter((_, index) => (mask & (1 << index)) !== 0));
  }
  return sets;
}

/**
 * The reader opened, somebody 3-bet, and it is back on him.
 *
 * The mirror of the list above: the hero raised from an earlier seat and the
 * villain re-raised from a later one, so the pairs run the other way round.
 * Fifteen again, and identical again at 100bb — the stack rule that separates
 * them only bites at 50 and below.
 */
const VS_3BET_NODES: ChartNode[] = RESPONSE_STACKS.flatMap((stackBb) =>
  POSITIONS.flatMap((position, hero) =>
    POSITIONS.slice(hero + 1).map((villain) =>
      nodeFromRules(VS_3BET_RULES, {
        scenario: "vs-3bet",
        position,
        villain,
        stackBb,
        treeId: TREE_ID,
      }),
    ),
  ),
);

/**
 * He 3-bet, they 4-bet.
 *
 * The tightest node in the set: two hands continue and the rest go in the muck.
 * Worth drilling precisely because it feels like it should be wider — QQ and AK
 * are enormous hands, and folding them here is the discipline the book asks for
 * at these stakes.
 *
 * **The seats run the other way to the 3-bet nodes**, and the first version of
 * this had them backwards. A 3-bet comes from someone acting *after* you, so
 * the villain is later. A 4-bet almost always comes from the player you
 * 3-bet — the original opener, sitting *earlier*. Generating villain-after-hero
 * would have modelled only the cold 4-bet, which the book singles out as the
 * rare case, and would have left the ordinary one uncharted.
 */
const VS_4BET_NODES: ChartNode[] = RESPONSE_STACKS.flatMap((stackBb) =>
  POSITIONS.flatMap((villain, opener) =>
    POSITIONS.slice(opener + 1).map((position) =>
      nodeFromRules(VS_4BET_RULES, {
        scenario: "vs-4bet",
        position,
        villain,
        stackBb,
        treeId: TREE_ID,
      }),
    ),
  ),
);

const RFI_NODES: ChartNode[] = RFI_RANGES.map((range) =>
  rfi(range.position, range.notation, range.limp),
);

/**
 * Limping behind a crowd, on the button.
 *
 * The book allows part of the late-position range to be limped rather than
 * raised "where there are a lot of limpers in front of you (3 or more)", with
 * a weak speculative hand — it pictures A3s, 44 and 56s.
 *
 * **Its own node, because the condition is real.** Folded to you on the button,
 * A3s is a raise; behind three limpers it is a limp. Putting the limp on the
 * opening node would have graded the ordinary button raise as a mistake, which
 * is both wrong and the more common spot by far.
 *
 * **The button only, and that is not a simplification.** Six-handed, at most
 * three players act before the button, so it is the earliest seat where three
 * limpers can exist at all — the cutoff has two players in front of it and can
 * never face the condition. In full ring the cutoff would qualify; this set is
 * not full ring.
 *
 * The raising range is the button's own with those hands removed, so nothing is
 * added or dropped — the same hands are played, three of them differently.
 */
const VS_LIMP_NODES: ChartNode[] = [
  node(
    { scenario: "vs-limp", position: "BTN", stackBb: STACK_BB, treeId: TREE_ID },
    {
      // Tracks the opening range above hand for hand — some of it limped
      // instead of raised, none of it added or dropped. Version 8's trim had
      // to come through here too: opening tighter when folded to while raising
      // K4o over three limpers would have the button playing *looser* against
      // more opponents, which is backwards.
      raise:
        "55+, A4s+, A4o+, K8s+, K8o+, Q6s+, Q9o+, J8s+, J8o+, T8s+, T9o, " +
        "67s, 78s, 89s, 64s, 75s, 86s, 97s, 87o, 98o",
      call: "22-44, A3s, A2s, A3o, A2o, 56s",
    },
  ),
];


export const BEGINNER_6MAX: ChartSet = {
  id: "beginner-6max",
  // 2 took BlackRain79's openers. 3 dropped the facing-a-raise nodes entirely.
  // 4 added the two hands his prose names that his chart row omitted, and began
  // grading limped pots, which his scope note covers and the parser had been
  // refusing. 5 added the big blind, which has a decision once a pot is limped
  // to it. Reviews and violations are stamped with the version that graded
  // them, so a hand scored under an older one stays interpretable instead of
  // being silently re-judged by numbers it was never shown.
  // 6 took the book's two limping rules: small pairs open-limped under the gun,
  // and part of the button's range limped behind three or more limpers.
  // 7 narrowed the hijack's AT and JT to suited only, on the reader's reading
  // of the prose the range was transcribed from.
  // 8 trimmed the button from 51% to the "around 40%" the book states, taking
  // its prose over its chart row for the second time.
  // 9 added facing a single raise — fifteen nodes generated from six rules
  // rather than authored, and the first scenario here that is not an open.
  // 10 closed the normal raise/three-bet/four-bet spine. 11 adds a sourced,
  // value-first squeeze family with caller identities retained for review.
  version: 11,
  name: "Crushing The Microstakes · 6-max · 100bb",
  provider: "authored",
  treeId: TREE_ID,
  stackBb: STACK_BB,
  // The convention named in the module header and in `treeId`, now stated as
  // data so the table can show the money without guessing at it.
  openBb: 2.5,
  sbOpenBb: 3,
  notes:
    "Opening ranges transcribed from BlackRain79's Crushing The Microstakes, " +
    "plus the whole facing-action tree — a raise, a 3-bet, a 4-bet — which is " +
    "generated from the book's own rules rather than authored as charts, " +
    "because it states one answer for each of those spots rather than one per " +
    "seat. The squeeze tree is deliberately value-first: QQ+ and AK, plus the " +
    "author's exact BB/JJ/two-caller example. Read-dependent light squeezes and " +
    "limped multiway pots past the button stay uncovered, and decisions this set does not cover are skipped rather than " +
    "guessed at. The small blind's " +
    "opening range is inferred — the book calls that spot player-dependent and " +
    "never states a width. It is not solver output, and every hand is a single " +
    "action rather than a mixed frequency, because one clear rule followed " +
    "well beats a frequency approximated badly.",
  nodes: [
    ...RFI_NODES,
    ...VS_LIMP_NODES,
    ...VS_OPEN_NODES,
    ...SQUEEZE_NODES,
    ...VS_3BET_NODES,
    ...VS_4BET_NODES,
  ],
};
