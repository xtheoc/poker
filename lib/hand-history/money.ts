/**
 * The one piece of PokerStars arithmetic that is easy to get wrong.
 *
 * PokerStars writes a raise as the street *total* — "raises $0.05 to $0.10" —
 * but writes a call, a bet and a blind post as the *increment*. Read them the
 * same way and every pot in the database is wrong by a blind or two, silently,
 * in a direction that varies by hand.
 *
 * It lives in its own module because two callers need it — the decision
 * extractor, which wants the pot at each moment, and the result calculator,
 * which wants the total a player put in — and a rule this subtle must not be
 * written down twice.
 */

import type { Action } from "./types";

/**
 * A player's new total for the current street after this action.
 *
 * `before` is what they had already committed on this street. Actions that move
 * no money return `before` unchanged, so this is safe to fold over every action
 * in a street without filtering first.
 */
export function streetTotalAfter(before: number, action: Action): number {
  if (action.amount === undefined) return before;

  switch (action.type) {
    case "raise":
      // Already a street total. Max rather than assignment because a raise
      // following the same player's earlier bet must never move backwards.
      return Math.max(before, action.amount);
    case "uncalled-return":
      // Chips handed back were never really in the pot.
      return Math.max(0, before - action.amount);
    case "collect":
      // Winning the pot is not a contribution to it.
      return before;
    default:
      return before + action.amount;
  }
}
