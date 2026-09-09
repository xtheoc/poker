/**
 * What a hand actually cost or made, and the handful of flags a session review
 * is built from.
 *
 * This is separate from the leak engine on purpose. The leak engine answers
 * "was that the right decision", which is a judgement; this answers "what
 * happened", which is arithmetic. Keeping them apart means a session review can
 * report results honestly even for hands nothing can grade — and at these stakes
 * most hands are exactly that.
 *
 * Everything is reported in big blinds. Reporting in dollars would make NL2
 * look like nothing is happening, and would stop comparing across stakes the
 * moment the stake changes.
 */

import type { Position } from "../poker/charts";
import { type Hand, handClassFromCards } from "../poker/hands";
import { streetTotalAfter } from "./money";
import type { ParsedHand } from "./types";

export interface HeroResult {
  /** Profit or loss, in big blinds. Negative is a loss. */
  netBb: number;
  investedBb: number;
  collectedBb: number;
  position: Position | null;
  /** The hero's hand as one of the 169 classes, when the cards are known. */
  handClass: Hand | null;
  /** Money in preflop by choice — blinds do not count. */
  vpip: boolean;
  /** Raised preflop. */
  pfr: boolean;
  sawFlop: boolean;
  wentToShowdown: boolean;
  wonAtShowdown: boolean;
  /** Collected anything at all, showdown or not. */
  won: boolean;
}

/**
 * The hero's result, or null when the hand does not have one.
 *
 * Null means the hand was observed rather than played — no hole cards, or the
 * hero was not seated. Those are worth storing and worth nothing to a review.
 */
export function heroResult(parsed: ParsedHand): HeroResult | null {
  if (!parsed.hero) return null;

  const bb = parsed.bigBlind;
  if (!bb || bb <= 0) return null;

  const hero = parsed.hero.player;
  const seat = parsed.seats.find((s) => s.player === hero);

  let invested = 0;
  let collected = 0;
  let vpip = false;
  let pfr = false;
  let foldedPreflop = false;
  let actedAfterPreflop = false;

  // Players who revealed or mucked a hand. Both only happen at a showdown, so
  // two or more of them is the most reliable showdown test available without
  // the parser retaining the section marker.
  const revealed = new Set<string>();

  for (const street of parsed.streets) {
    const wagered = new Map<string, number>();

    for (const action of street.actions) {
      if (action.type === "show" || action.type === "muck") {
        revealed.add(action.player);
      }

      if (action.player === hero) {
        if (street.street === "preflop") {
          if (action.type === "call" || action.type === "bet") vpip = true;
          if (action.type === "raise") {
            vpip = true;
            pfr = true;
          }
          if (action.type === "fold") foldedPreflop = true;
        } else if (
          action.type === "fold" ||
          action.type === "check" ||
          action.type === "call" ||
          action.type === "bet" ||
          action.type === "raise"
        ) {
          actedAfterPreflop = true;
        }

        if (action.type === "collect" && action.amount !== undefined) {
          collected += action.amount;
        }
      }

      const before = wagered.get(action.player) ?? 0;
      wagered.set(action.player, streetTotalAfter(before, action));
    }

    invested += wagered.get(hero) ?? 0;
  }

  const wentToShowdown = revealed.size >= 2 && revealed.has(hero);
  // Seeing a flop needs both a flop and a hero still in the hand for it. Acting
  // postflop proves it outright; being all-in preflop means no postflop action
  // ever appears, which is why not-folding is the fallback rather than the test.
  const flopDealt = parsed.streets.some((s) => s.street === "flop");
  const sawFlop = actedAfterPreflop || (flopDealt && !foldedPreflop);

  return {
    netBb: round((collected - invested) / bb),
    investedBb: round(invested / bb),
    collectedBb: round(collected / bb),
    position: seat?.position ?? null,
    handClass: handClassFromCards(parsed.hero.cards),
    vpip,
    pfr,
    sawFlop,
    wentToShowdown,
    wonAtShowdown: wentToShowdown && collected > 0,
    won: collected > 0,
  };
}

/** Two decimals of a big blind: finer than that is noise at any stake. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
