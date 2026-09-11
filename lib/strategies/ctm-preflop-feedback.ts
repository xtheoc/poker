import type { ActionKind } from "../poker/charts";
import type { QuickfireSpot } from "../poker/quickfire";

const VALUE_3BET = new Set(["AA", "KK", "QQ", "AKs", "AKo"]);
const FLAT_OPEN = new Set(["JJ", "TT", "AQs", "AQo"]);
const FOUR_BET = new Set(["AA", "KK", "QQ", "JJ", "AKs", "AKo"]);
const CALL_3BET = new Set(["88", "99", "TT", "AQs", "AQo"]);

function isPair(hand: string): boolean {
  return hand.length === 2 && hand[0] === hand[1];
}

/**
 * The short explanation shown after a missed preflop action.
 *
 * It is intentionally a consequence of the lesson rule, not generic poker
 * prose. A correction that only says "raise" teaches a button press; this one
 * states why the hand belongs in that branch of this strategy's tree.
 */
export function ctmPreflopCorrection(
  drillId: string,
  spot: QuickfireSpot,
  expected: ActionKind,
): string | undefined {
  if (drillId === "facing-open") {
    if (VALUE_3BET.has(spot.hand)) {
      return "Three-bet for value: AA, KK, QQ and AK want the larger pot.";
    }
    if (FLAT_OPEN.has(spot.hand)) {
      return "Call: this is strong enough to continue, but not a baseline hand to three-bet and face a four-bet.";
    }
    if (expected === "call" && isPair(spot.hand)) {
      return "Call only as a set-mine: at normal depth, the implied odds justify the pocket pair.";
    }
    return "Fold by default. A call needs a named reason: set-mining, protecting a strong hand versus a tight early open, or position with a fish already involved.";
  }

  if (drillId === "facing-3bet") {
    if (FOUR_BET.has(spot.hand)) {
      return "Four-bet for value at 100bb: AA, KK, QQ, JJ and AK.";
    }
    if (CALL_3BET.has(spot.hand)) {
      return "Call at 100bb: 88 through TT and AQ are the deliberate flatting tier.";
    }
    return "Fold. At normal depth, everything outside the four-bet and calling tiers gives up too much in a three-bet pot.";
  }

  if (drillId === "facing-4bet") {
    if (spot.hand === "AA" || spot.hand === "KK") {
      return "Continue: at normal 100bb depth, this strategy gets AA and KK in against a four-bet.";
    }
    return "Fold. The normal NL2 baseline continues only with AA and KK after a four-bet.";
  }

  return undefined;
}
