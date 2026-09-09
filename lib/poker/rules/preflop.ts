/**
 * Facing a raise, as the book states it.
 *
 * Six rules, in order, covering all fifteen seat pairs. The order is the
 * argument: the book presents this as a default with named exceptions, and
 * reading them top to bottom is reading the paragraph.
 *
 *   1. 3-bet the top of your range for value.
 *   2. Call the tier below it, which has value but cannot stand a 4-bet.
 *   3. Set-mine a pocket pair when the stacks pay for it.
 *   4. Otherwise fold.
 *
 * Two further exceptions the book gives are authored here and marked
 * `needsRead`, because each names a specific opponent: a light 3-bet needs
 * someone who folds too much, and calling a speculative hand needs a fish
 * already in the pot. They stay out of the generated ranges — being marked
 * wrong for not making a read the app cannot see is worse than not grading the
 * spot at all.
 *
 * **The generated nodes come out identical at every seat pair, and that is the
 * lesson rather than a defect.** The book's answer to "someone raised" does not
 * depend on who raised or where you sit; only the stack condition varies, and
 * at 100bb it never binds. Fifteen spots giving one answer is what tells you
 * there is one rule here, not fifteen charts.
 */

import type { Hand } from "../hands";
import type { Rule } from "../rules";

/**
 * The 3-bet-for-value range: hands strong enough to want a bigger pot.
 *
 * Deliberately four. The book's 3-bet frequency at these stakes is about 5% in
 * 6-max and almost all of it value, for reasons it states plainly: a shallower
 * stack favours the worse player, micro players do not fold to 3-bets, and even
 * regs turn into calling stations in a 3-bet pot.
 */
const VALUE_3BET: ReadonlySet<Hand> = new Set<Hand>([
  "AA",
  "KK",
  "QQ",
  "AKs",
  "AKo",
]);

/**
 * Plenty of value, and still cannot stand a 4-bet.
 *
 * The book is explicit that these are calls rather than 3-bets: they fold badly
 * to a re-raise and make ugly postflop spots against opponents who will not
 * fold. Keep the pot small and outplay them after the flop.
 */
const FLAT_CALL: ReadonlySet<Hand> = new Set<Hand>(["JJ", "TT", "AQs", "AQo"]);

/** Pairs, which set-mine. A pair is the same rank twice and no suffix. */
function isPair(hand: Hand): boolean {
  return hand.length === 2 && hand[0] === hand[1];
}

/**
 * Stack needed behind to call a raise with a pair, in big blinds.
 *
 * The book asks for 15:1 on their stack against the raise you are calling,
 * which lands near these numbers against a standard open. It is 15:1 rather
 * than the 8.5:1 the flop odds suggest because you do not get paid every time
 * you hit — a lot of the time your set beats ace-high and wins nothing.
 *
 * Out of position it takes more, because extraction is the whole point of the
 * call: they can check behind and kill your check-raise, and one missed betting
 * round makes getting stacks in by the river very hard.
 */
export const SET_MINE_BB = 50;
export const SET_MINE_OOP_BB = 70;

export const VS_OPEN_RULES: readonly Rule[] = [
  {
    id: "vs-open/3bet-value",
    scenario: "vs-rfi",
    cite: "Preflop — 3-betting",
    summary: "3-bet AA, KK, QQ and AK for value.",
    when: (spot) => VALUE_3BET.has(spot.hand),
    then: "raise",
  },

  // Ahead of set-mining, because JJ and TT are pairs and it would otherwise
  // claim them. The action is the same either way, so the ordering only decides
  // which sentence you are shown when you get it wrong — and "cannot stand a
  // 4-bet" is the more useful one for a hand this strong.
  {
    id: "vs-open/flat-strong",
    scenario: "vs-rfi",
    cite: "Preflop — 3-betting, 'prefer to call'",
    summary:
      "Call with JJ, TT and AQ. Loads of value, but they cannot stand a 4-bet.",
    when: (spot) => FLAT_CALL.has(spot.hand),
    then: "call",
  },

  {
    id: "vs-open/set-mine",
    scenario: "vs-rfi",
    cite: "Preflop — set mining, properly",
    summary:
      "Call with a pocket pair when there is 15:1 behind — 50bb, or 70bb out of position.",
    when: (spot) =>
      isPair(spot.hand) &&
      spot.stackBb >= (spot.inPosition ? SET_MINE_BB : SET_MINE_OOP_BB),
    then: "call",
  },

  // --- Below here: real strategy, held out of the generated ranges. ---

  {
    id: "vs-open/flat-speculative",
    scenario: "vs-rfi",
    cite: "Preflop — calling a raise, reason 3",
    summary:
      "Call a speculative hand in position when a fish is already in. Fold it otherwise, and always from the blinds.",
    when: (spot) => spot.inPosition && spot.fishInPot === true,
    then: "call",
    needsRead: true,
  },

  {
    id: "vs-open/3bet-light",
    scenario: "vs-rfi",
    cite: "Preflop — light 3-bet",
    summary:
      "3-bet light only in position, and only against someone folding to 3-bets or cbets over 70% across 100+ hands.",
    when: (spot) => spot.inPosition && spot.foldsTooMuch === true,
    then: "raise",
    needsRead: true,
  },

  {
    id: "vs-open/fold",
    scenario: "vs-rfi",
    cite: "Preflop — 'your default is 3-bet or fold, and usually fold'",
    summary: "Fold. Facing a raise this is the answer far more often than not.",
    when: () => true,
    then: "fold",
  },
];

/**
 * The 4-bet range at 6-max.
 *
 * Aces and kings only in full ring; six-handed the book adds AK, QQ and JJ,
 * because opening ranges are wider and so is everyone's 3-betting range. This
 * set is 6-max, so it takes the wider list.
 */
const VALUE_4BET: ReadonlySet<Hand> = new Set<Hand>([
  "AA",
  "KK",
  "QQ",
  "JJ",
  "AKs",
  "AKo",
]);

/**
 * What calls a 3-bet, once the 4-betting hands are taken out.
 *
 * "Call with roughly 88+ and AQ/AK — and the top of that is 4-betting anyway."
 * With JJ+ and AK 4-betting at 6-max, what is left to call is 88 through TT
 * and AQ.
 */
const CALL_3BET: ReadonlySet<Hand> = new Set<Hand>([
  "TT",
  "99",
  "88",
  "AQs",
  "AQo",
]);

/** Below this, the book says fold or jam and never call. */
export const NEVER_CALL_A_3BET_UNDER_BB = 50;

/**
 * Facing a 3-bet.
 *
 * The shortest ruleset here, and the most expensive one to get wrong. Calling
 * a 3-bet at 100bb is very hard to make profitable: you miss the flop, check-
 * fold, and give up ten or twelve big blinds. Nine or ten of those is a stack.
 */
export const VS_3BET_RULES: readonly Rule[] = [
  {
    id: "vs-3bet/4bet-value",
    scenario: "vs-3bet",
    cite: "Preflop — 4-bets",
    summary:
      "4-bet AA, KK, QQ, JJ and AK at 6-max. Aces and kings only in full ring.",
    when: (spot) => VALUE_4BET.has(spot.hand),
    then: "raise",
  },

  // Ahead of the call tier so the short-stack rule cannot swallow a 4-bet:
  // "fold or jam" at 50bb still jams these, and jamming is a raise.
  {
    id: "vs-3bet/short-never-call",
    scenario: "vs-3bet",
    cite: "Preflop — when they 3-bet you, 50bb stacks",
    summary:
      "At 50bb or less it is fold or jam, never call. A call leaves a stack-to-pot ratio you cannot play.",
    when: (spot) => spot.stackBb <= NEVER_CALL_A_3BET_UNDER_BB,
    then: "fold",
  },

  {
    id: "vs-3bet/call",
    scenario: "vs-3bet",
    cite: "Preflop — when they 3-bet you",
    summary: "Call with 88 through TT and AQ. Everything else folds.",
    when: (spot) => CALL_3BET.has(spot.hand),
    then: "call",
  },

  // The book's min-3-bet exception is deliberately not a rule here. It says to
  // "call considerably wider" against a min-3-bettor with 50bb+ and does not
  // say how much wider — and a rule conditioned only on position and stack
  // would call with everything, which is not what it means. Better to leave
  // the spot on the default than to invent a range and grade against it.

  {
    id: "vs-3bet/fold",
    scenario: "vs-3bet",
    cite: "Preflop — when they 3-bet you, 'fold, especially out of position'",
    summary:
      "Fold. You miss the flop, check-fold, and give up 10–12bb; ten of those is a stack.",
    when: () => true,
    then: "fold",
  },
];

/**
 * Facing a 4-bet after your own 3-bet.
 *
 * Two lines. Almost nobody at these stakes 4-bets without the nuts, and the
 * book's own note on kings is the only thing keeping this from being a single
 * rule: at 100bb or less you never fold them, because someone else holds aces
 * only about 3% of the time six-handed.
 */
export const VS_4BET_RULES: readonly Rule[] = [
  // Above the general rule, not below it. Rules are first-match, so an
  // exception ordered after the rule it excepts can never fire — and this one
  // is exactly the shape that would look authored and do nothing.
  {
    id: "vs-4bet/nit-cold-4bet",
    scenario: "vs-4bet",
    cite: "Preflop — the cold 4-bet exception",
    summary:
      "The one laydown: a cold 4-bet from the table's biggest nit, or 200bb+ deep against a nit. Nobody bluffs there — fold the kings.",
    when: (spot) =>
      spot.hand === "KK" &&
      spot.villainType === "nit" &&
      spot.stackBb >= 200,
    then: "fold",
    needsRead: true,
  },

  {
    id: "vs-4bet/continue",
    scenario: "vs-4bet",
    cite: "Preflop — folding kings",
    summary:
      "Get it in with aces and kings. At 100bb or less, kings are never a fold — someone holds aces about 3% of the time.",
    when: (spot) => spot.hand === "AA" || spot.hand === "KK",
    then: "raise",
  },

  {
    id: "vs-4bet/fold",
    scenario: "vs-4bet",
    cite: "Preflop — 'if your 3-bet gets 4-bet at 100bb, fold'",
    summary:
      "Fold. Almost nobody here 4-bets without the nuts. QQ, JJ and AK become jams by NL25 — not at these stakes.",
    when: () => true,
    then: "fold",
  },
];
