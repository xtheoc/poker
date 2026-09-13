/** The first complete learner-facing strategy: BlackRain79's NL2 six-max TAG system. */

import { BEGINNER_6MAX } from "../poker/charts/beginner-6max";
import type { ChartNode, ChartSet } from "../poker/charts";
import type { Hand } from "../poker/hands";
import { PLAYSTYLE } from "../playstyle";
import type { Strategy } from "./index";
import type { SourceReference, StrategyLearningSystem } from "./learning";

const book = (pages: readonly number[], label: string): SourceReference => ({
  sourceId: "ctm-book",
  pages,
  label,
});

const notes = (label: string): SourceReference => ({
  sourceId: "player-directives",
  pages: [1],
  label,
});

const CTM_TREE_ID = "ctm-nl2-4-3";
const EP_SMALL_PAIRS: readonly Hand[] = ["22", "33", "44", "55", "66"];

/**
 * The actual opening chart taught by this strategy, in the same notation a
 * player can carry to the table. It intentionally differs from the older
 * shared BlackRain transcription in one place: the author's later NL2
 * correction promotes UTG 22-66 from a limp to a raise.
 */
export const CTM_NL2_RANGE_REFERENCE: NonNullable<Strategy["rangeReference"]> = [
  { position: "UTG", raise: "22+, AJs+, AJo+, KQs, KQo" },
  { position: "HJ", raise: "22+, ATs+, AJo+, KJs+, KJo+, JTs" },
  {
    position: "CO",
    raise:
      "22+, A2s+, A2o+, K8s+, K8o+, Q9s+, Q9o+, J8s+, J8o+, 56s, 67s, 78s, 89s, T9s, 75s, 86s, 97s, T8s",
  },
  {
    position: "BTN",
    raise:
      "22+, A2s+, A2o+, K8s+, K8o+, Q6s+, Q9o+, J8s+, J8o+, T8s+, T9o, 56s, 67s, 78s, 89s, 64s, 75s, 86s, 97s, 87o, 98o",
  },
  {
    position: "SB",
    raise: "22+, ATs+, AJo+, KJs+, KJo+, JTs",
    caveat:
      "Player-dependent: open wider when the big blind folds too much; tighten when it calls or three-bets often.",
  },
];

/**
 * A source-specific chart identity, rather than a renamed copy of the legacy
 * 2.5bb trainer. The action tree is shared because it was already transcribed
 * from this book; the NL2 sizing and the book's later early-pair correction
 * belong to this strategy alone.
 */
function ctmNode(node: ChartNode): ChartNode {
  const strategies = { ...node.strategies };
  if (node.key.scenario === "rfi" && node.key.position === "UTG") {
    for (const hand of EP_SMALL_PAIRS) strategies[hand] = { raise: { freq: 1 } };
  }
  return { key: { ...node.key, treeId: CTM_TREE_ID }, strategies };
}

export const CTM_NL2_CHART: ChartSet = {
  ...BEGINNER_6MAX,
  id: "ctm-nl2-preflop",
  version: 3,
  name: "Crushing the Microstakes · NL2 · 6-max · 100bb",
  treeId: CTM_TREE_ID,
  openBb: 4,
  sbOpenBb: 4,
  openSizes: { CO: 3, BTN: 3 },
  notes:
    "BlackRain79's NL2 six-max action baseline. Opens are 4bb in early and " +
    "middle position and 3bb in cutoff/button; 22-66 raise in early position " +
    "under the author's 2015 correction. It is a teaching simplification, not " +
    "solver output. The source-backed squeeze baseline is value-only: QQ+ and AK, plus the explicit BB JJ/two-caller example. Conditional reads remain drills until an analyser can prove them.",
  nodes: BEGINNER_6MAX.nodes.map(ctmNode),
};

/**
 * This is intentionally source-heavy. A lesson can simplify a decision, but
 * its source pages remain attached so the learner can inspect the reasoning
 * and the original figure in their own private copy of the book.
 */
export const CTM_NL2_LEARNING: StrategyLearningSystem = {
  sources: [
    { id: "ctm-book", title: "Crushing the Microstakes", author: "Nathan Williams (BlackRain79)", kind: "book", required: true },
    { id: "blackrain-squeeze", title: "Why You Need to Make the Squeeze Play More Often at Lower Stakes", author: "Nathan Williams (BlackRain79)", kind: "other", required: false },
    { id: "player-directives", title: "Personal NL2 implementation notes", kind: "notes", required: false },
  ],
  setup: [
    { id: "hud-ready", label: "Five-stat HUD is configured", detail: "Hands, VPIP, PFR, fold to flop c-bet, and aggression factor only.", required: true },
    { id: "history-ready", label: "Hand histories are saved locally", detail: "The first strategy reviews regular NL2 six-max cash hands after a session.", required: true },
    { id: "study-only", label: "Study stays closed while PokerStars is open", detail: "This is a post-session training tool, never a live decision aid.", required: true },
  ],
  drills: [
    { id: "player-types", label: "Player types", description: "Read a compact HUD and name the opponent.", kind: "classification" },
    { id: "open-ranges", label: "Opening ranges", description: "Build each positional range from a blank grid.", kind: "range" },
    { id: "open-sizing", label: "Opening and iso sizing", description: "Choose the size from position, limpers and blind status.", kind: "sizing" },
    { id: "facing-open", label: "Facing an open", description: "Name the reason to fold, call or three-bet.", kind: "decision" },
    { id: "squeeze", label: "Squeeze for value", description: "Recognise the open, caller and value re-raise without inventing a bluff.", kind: "decision" },
    { id: "facing-3bet", label: "Facing a three-bet", description: "Continue with a deliberate four-bet, call or fold plan.", kind: "decision" },
    { id: "facing-4bet", label: "Facing a four-bet", description: "Practise the narrow, stack-aware continuation rule.", kind: "decision" },
    { id: "flop-plan", label: "Flop plan", description: "Choose check, value bet or pressure from board, position and opponent.", kind: "decision" },
    { id: "cbet-response", label: "After the c-bet", description: "Read a lead, call, raise or min-raise without guessing.", kind: "decision" },
    { id: "turn-plan", label: "Turn discipline", description: "Continue for value, pressure with equity, or stop investing.", kind: "decision" },
    { id: "river-plan", label: "River extraction", description: "Value bet, bluff-catch or fold from hand strength and opponent evidence.", kind: "decision" },
    { id: "table-recall", label: "Table recall", description: "State the rule and its exception in your own words.", kind: "recall" },
  ],
  tracking: {
    label: "Regular NL2 six-max cash hands",
    filterVersion: "ctm-nl2-v1",
    filter: { gameTypes: ["cash"], seatCounts: [6], maximumBigBlind: 0.02, fastFold: false },
    metricIds: ["hands", "net-bb", "vpip", "pfr", "preflop-accuracy"],
  },
  lessons: [
    {
      id: "read-the-table", title: "Read the table", summary: "Use five HUD numbers to find the player you are trying to exploit.", prerequisites: [],
      assets: [
        { id: "five-stat-hud", kind: "rewrite", title: "Read only what is reliable", body: "After 20 hands, VPIP and PFR are useful: loose or tight, passive or aggressive.\n\nAfter 100 hands, use fold-to-cbet and aggression factor. The goal is one simple exploit for the next hand, not a permanent label.", sources: [book([28, 34], "HUD sample sizes and player types"), notes("Five-stat HUD")] },
        { id: "five-types", kind: "rewrite", title: "One plan per player", body: "Nit: steal more, respect late aggression. TAG: avoid marginal pots.\n\nLoose-passive or fish: value bet; do not bluff. Maniac: let your strong hands catch their aggression.", sources: [book([35, 42], "Player types and adjustments")] },
      ],
      mastery: [{ kind: "drill", drillId: "player-types", minimumRuns: 2, minimumAccuracy: 100, minimumAnswers: 10 }],
      playbook: [{ id: "hud", heading: "Read before acting", takeaway: "Use VPIP/PFR after 20 hands. Use fold-to-cbet and AF only after 100. Value-bet loose callers; bluff fold-prone players; give tight aggression credit.", sources: [book([28, 42], "HUD and player types")] }],
    },
    {
      id: "open-with-purpose", title: "Open with purpose", summary: "Build the positional range, then know whether each entry is a raise, limp or fold.", prerequisites: ["read-the-table"],
      assets: [
        { id: "position-first", kind: "rewrite", title: "Read the seat before the cards", body: "Early: play fewer hands. You will often be out of position after the flop.\n\nCO and BTN: play more hands. Position makes those seats your profit seats.\n\nBlinds: stay disciplined. Do not force marginal pots out of position.", sources: [book([65, 75], "Six-max position and starting-hand charts")] },
        { id: "ep-pairs-revision", kind: "rewrite", title: "Small pairs in early position", body: "At NL2, raise 22-66 from early position.\n\nThe original book proposed limping them. Its later correction changes that answer; this strategy follows the correction.", sources: [book([69, 70], "Small pairs in early position and 2015 correction")] },
      ],
      mastery: [{ kind: "drill", drillId: "open-ranges", minimumRuns: 1, minimumAccuracy: 100, minimumAnswers: 5 }],
      playbook: [{ id: "ranges", heading: "Position first", takeaway: "Open tight early, expand hard in late position, and treat the blinds as a player-dependent damage-control seat. Use the chart for the hand list.", sources: [book([65, 75], "Starting-hand ranges")] }],
    },
    {
      id: "size-the-pot", title: "Size the pot", summary: "Use one sizing ladder so the next action is never improvised.", prerequisites: ["open-with-purpose"],
      assets: [{ id: "open-ladder", kind: "rewrite", title: "Use one sizing ladder", body: "UTG and HJ: open 4bb. CO and BTN: open 3bb.\n\nAdd 1bb for every limper. From the blinds, add one more 1bb per limper. Small blind limps into your big blind: raise to 4bb.", sources: [book([76, 90], "NL2 opening and limper sizing"), notes("NL2 sizing ladder")] }],
      mastery: [{ kind: "drill", drillId: "open-sizing", minimumRuns: 2, minimumAccuracy: 100, minimumAnswers: 15 }],
      playbook: [{ id: "sizing", heading: "NL2 sizing", takeaway: "EP/MP 4bb. CO/BTN 3bb. Add 1bb per limper; add one more per limper from the blinds. SB limp into BB: raise to 4bb.", sources: [book([76, 90], "Sizing")]}],
    },
    {
      id: "face-an-open", title: "Face an open", summary: "Most calls are a leak. Learn the three reasons a call is allowed.", prerequisites: ["size-the-pot"],
      assets: [
        { id: "three-call-reasons", kind: "rewrite", title: "Calling needs a reason", body: "Default: three-bet or fold. Calling is the exception, not the default.\n\nCall a pocket pair only when the stack is deep enough to win a full pot when you hit. Call a speculative hand only in position, with a fish already in the pot. Otherwise, fold.", sources: [book([91, 97], "Calling raises")] },
        { id: "value-three-bet", kind: "rewrite", title: "Keep the three-bet simple", body: "Your baseline value three-bet is AA, KK, QQ and AK.\n\nDo not add light three-bets just to be aggressive. Add one only when you are in position and the HUD proves the opener folds too much.", sources: [book([98, 104], "Three-betting and light exceptions")] },
      ],
      mastery: [{ kind: "drill", drillId: "facing-open", minimumRuns: 3, minimumAccuracy: 100, minimumAnswers: 10 }],
      playbook: [{ id: "facing-open", heading: "Facing an open", takeaway: "Default three-bet or fold. Calls need a reason: set-mine with depth, protect a strong hand versus a tight early open, or play a speculative hand in position with a fish involved.", sources: [book([96, 103], "Facing an open")]}],
    },
    {
      id: "squeeze", title: "Squeeze for value", summary: "Turn the open-plus-caller line into a deliberate value re-raise, not an automatic bluff.", prerequisites: ["face-an-open"],
      assets: [
        { id: "squeeze-baseline", kind: "rewrite", title: "The decision", body: "A squeeze is: open, caller, then you re-raise.\n\nAt NL2, squeeze QQ+ and AK. The callers make your good hands more valuable; they do not turn a marginal hand into a bluff.\n\nOne exact exception: from the big blind, squeeze JJ after an early open and two callers. Otherwise, fold unless you have a verified read.", sources: [{ sourceId: "blackrain-squeeze", pages: [1], label: "Definition, BB JJ example and dead-money rationale" }, book([98, 104], "Value three-betting baseline")] },
        { id: "squeeze-sizing", kind: "rewrite", title: "The size", body: "In position: 3 times the open. Out of position: 4 times the open.\n\nThen add 1bb for every caller. The larger size charges callers and stops a cheap multiway pot.", sources: [{ sourceId: "blackrain-squeeze", pages: [1], label: "Squeeze context" }, book([98, 104], "Three-bet sizing")] },
      ],
      mastery: [{ kind: "drill", drillId: "squeeze", minimumRuns: 3, minimumAccuracy: 100, minimumAnswers: 10 }],
      playbook: [{ id: "squeeze", heading: "Squeeze", takeaway: "Open plus caller(s): squeeze QQ+ and AK for value. BB JJ is a squeeze only in the source’s exact early-open plus two-caller spot. Otherwise fold unless you have a verified read. Size 3x IP or 4x OOP, plus 1bb per caller.", sources: [{ sourceId: "blackrain-squeeze", pages: [1], label: "Lower-stakes squeeze play" }, book([98, 104], "Three-bet sizing")] }],
    },
    {
      id: "three-bet-tree", title: "Face the three-bet", summary: "Separate four-bet, call and fold decisions before the flop creates a large pot.", prerequisites: ["squeeze"],
      assets: [{ id: "three-bet-response", kind: "rewrite", title: "At 100bb", body: "Four-bet AA, KK, QQ, JJ and AK. Call 88-TT and AQ. Fold everything else.\n\nAt 50bb or less, never call a three-bet. Your choice is jam with value or fold.", sources: [book([107, 110], "Facing a three-bet and four-bets"), notes("Three-bet response tree")] }],
      mastery: [{ kind: "drill", drillId: "facing-3bet", minimumRuns: 3, minimumAccuracy: 100, minimumAnswers: 10 }],
      playbook: [{ id: "vs-3bet", heading: "When they three-bet", takeaway: "At 100bb: four-bet AA, KK, QQ, JJ, AK; call 88-TT and AQ; fold the rest. At 50bb or less, do not call.", sources: [book([107, 110], "Facing three-bets")]}],
    },
    {
      id: "four-bet-tree", title: "Face the four-bet", summary: "Avoid turning a rare, expensive spot into an ego contest.", prerequisites: ["three-bet-tree"],
      assets: [{ id: "four-bet-response", kind: "rewrite", title: "The simple NL2 default", body: "After you three-bet and they four-bet: continue only with AA and KK. Fold everything else.\n\nThe exception is KK, 200bb+ deep, against a verified nit. That is an exception, not a routine decision.", sources: [book([109, 111], "Four-bets and the kings exception")] }],
      mastery: [{ kind: "drill", drillId: "facing-4bet", minimumRuns: 2, minimumAccuracy: 100, minimumAnswers: 10 }],
      playbook: [{ id: "vs-4bet", heading: "When they four-bet", takeaway: "At normal 100bb depth, continue with AA and KK; fold the rest. The deep nit cold-four-bet is a named exception, not a routine call-down.", sources: [book([109, 111], "Facing a four-bet")]}],
    },
    {
      id: "flop-plan", title: "Flop: make the first decision", summary: "First identify the action. Then check, bet, or give up for one clear reason.", prerequisites: ["four-bet-tree"],
      assets: [
        { id: "plan-not-hope", kind: "rewrite", title: "1. Decide what happened before you act", body: "Did they bet first? A tiny donk bet is a check. If they donk often, attack with equity. Otherwise, do not force a bluff.\n\nDid they check to you? In a multiway pot, continue only with top pair or a strong draw. Heads-up, wet-board air out of position against a fish or SLP checks and folds to a real bet.\n\nBefore betting, name the turn card you want and the hand that calls. If you cannot name both, check.", sources: [book([130, 141], "Planning a hand and c-bet exceptions")] },
        { id: "cbet-sizes", kind: "rewrite", title: "2. Pick the c-bet size", body: "55%: you missed on a dry ace- or king-high board with two low cards and no flush draw.\n\n60%: your default missed-board pressure. 75%: a good hand against a sticky regular. 100%: top pair good kicker or better against a fish or SLP. 150%: a monster against someone who will not fold.\n\nSmall bets make dry misses fold. Large bets charge a caller when you have value.", sources: [book([132, 151], "C-bet plans and sizing")] },
      ],
      mastery: [{ kind: "drill", drillId: "flop-plan", minimumRuns: 2, minimumAccuracy: 85 }],
      playbook: [{ id: "flop", heading: "Flop plan", takeaway: "1. Did they lead, or check to you? 2. Multiway or wet air OOP versus callers: check. 3. If betting, choose the size from board, hand and opponent. 4. Know the turn you want before you put money in.", sources: [book([130, 151], "Flop")]}],
    },
    {
      id: "after-the-cbet", title: "Flop: after your c-bet", summary: "A raise, min-raise and call each lead to a different next step.", prerequisites: ["flop-plan"],
      assets: [{ id: "response-tree", kind: "rewrite", title: "Read the response in order", body: "They raise normally: fold. At NL2, a real flop raise is value-heavy, even against top pair.\n\nThey min-raise: call only in position with middle pair or top pair. Air folds.\n\nThey call: check fold-to-c-bet. A player who folds 70% or more rarely calls light, so stop bluffing. A player who folds 59% or less is sticky, so keep betting your value hands.", sources: [book([151, 168], "Donk bets, raises and floats")] }],
      mastery: [{ kind: "drill", drillId: "cbet-response", minimumRuns: 2, minimumAccuracy: 85 }],
      playbook: [{ id: "cbet-response", heading: "After your c-bet", takeaway: "Real raise: fold. Min-raise: call IP with a pair, fold air. Call from a high-folder: strong, stop bluffing. Call from a sticky player: value bet again.", sources: [book([151, 168], "After the c-bet")]}],
    },
    {
      id: "turn-discipline", title: "Turn: decide to continue or stop", summary: "Weak hands stop. Value hands bet callers. Draws bluff only when they can fold.", prerequisites: ["after-the-cbet"],
      assets: [{ id: "turn-rules", kind: "rewrite", title: "Start with your hand strength", body: "No top pair, overpair or good draw: stop. Check-fold to a real bet.\n\nTop pair or a small overpair versus a fish or SLP: bet 75% pot. The same hand versus a TAG: check or check-fold. Two pair or better: bet 75% or more against everyone.\n\nIf they raise or lead big, fold often. If your hand cannot beat two pair, folding is the default. A draw can bet again only against someone who can fold; never bluff a fish.", sources: [book([168, 180], "Turn play")] }],
      mastery: [{ kind: "drill", drillId: "turn-plan", minimumRuns: 2, minimumAccuracy: 85 }],
      playbook: [{ id: "turn", heading: "Turn discipline", takeaway: "1. No made hand or good draw: stop. 2. One pair values fish/SLP, controls versus TAG. 3. Two pair or better bets big. 4. Turn strength from them deserves credit.", sources: [book([168, 180], "Turn")]}],
    },
    {
      id: "river-extraction", title: "River: value, bluff-catch or fold", summary: "First name your hand. Then decide who calls worse, or whether their bet can be a bluff.", prerequisites: ["turn-discipline"],
      assets: [{ id: "river-value", kind: "rewrite", title: "Name your hand before you act", body: "No pair: give up. The exception is AJ-high or better against a fish's quarter-pot bet when obvious draws missed.\n\nTop pair: bet about two-thirds pot; bet bigger against fish or SLP. Middle pair: value bet fish or SLP, but check against a TAG unless you have a great kicker. Third pair or worse checks down.\n\nFacing a bet: aggression factor 1 folds. Aggression factor 2 or more can call a safe river. Pot-size bets and overbets fold. If they raise your bet three times or more, fold.", sources: [book([181, 194], "River value and calling")] }],
      mastery: [{ kind: "drill", drillId: "river-plan", minimumRuns: 2, minimumAccuracy: 85 }, { kind: "recall", minimumAttempts: 1, minimumScore: 80 }],
      playbook: [{ id: "river", heading: "River extraction", takeaway: "1. No pair: usually give up. 2. Value bet hands worse players call. 3. Bluff-catch only against the right player and safe card. 4. Big river aggression folds by default.", sources: [book([181, 194], "River")]}],
    },
  ],
};

const LEGACY_CURRICULUM = CTM_NL2_LEARNING.lessons.map((lesson) => ({
  id: lesson.id,
  title: lesson.title,
  summary: lesson.summary,
  unlocksPlaybook: lesson.playbook.map((entry) => entry.id),
  gate: null,
}));

export const CTM_NL2: Strategy = {
  id: "ctm-nl2",
  name: "Crushing the Microstakes",
  tagline: "NL2 6-max cash · BlackRain79 baseline",
  chartSet: CTM_NL2_CHART,
  rangeReference: CTM_NL2_RANGE_REFERENCE,
  playbook: PLAYSTYLE,
  curriculum: LEGACY_CURRICULUM,
  learning: CTM_NL2_LEARNING,
  kpis: [
    { id: "hands", label: "Hands", compute: "hands", format: "count" },
    { id: "net-bb", label: "Net bb", compute: "netBb", format: "bb" },
    { id: "vpip", label: "VPIP", compute: "vpip", format: "percent" },
    { id: "pfr", label: "PFR", compute: "pfr", format: "percent" },
    { id: "preflop-accuracy", label: "Preflop accuracy", compute: "accuracy", format: "percent" },
  ],
  matchRule: {
    label: "Regular NL2 six-max cash hands",
    match: (hand) => hand.gameType === "cash" && hand.bigBlind <= 0.02 && hand.maxSeats === 6 && !hand.fastFold,
  },
};
