/**
 * Turning a hand class into two cards you can actually look at.
 *
 * Everything upstream reasons in hand *classes* — "AKo" is one of 169 things a
 * chart has an opinion about, and the suits genuinely do not matter preflop
 * beyond suited-or-not. That is correct for the strategy and wrong for the
 * screen: nobody is dealt "AKo" at a table, they are dealt the ace of hearts
 * and the king of spades, and recognising *that* fast is the skill being
 * trained. A drill that shows a three-letter code trains reading three-letter
 * codes.
 *
 * So suits are chosen once, at deal time, and carried on the spot. Chosen at
 * deal time rather than at render time for the same reason the hand itself is:
 * a component that picks random suits while rendering produces different output
 * every time React re-runs it, and the card would change suit under your eyes
 * when the feedback state flips.
 *
 * Nothing here affects grading. These are the same 169 classes with a face on.
 */

import { type Hand, parseHand } from "./hands";

/** Suits, in the conventional bridge order. */
export const SUITS = ["s", "h", "d", "c"] as const;

export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: string;
  suit: Suit;
}

/** What each suit is drawn as, and whether it is a red suit. */
export const SUIT_PIPS: Record<Suit, { pip: string; red: boolean }> = {
  s: { pip: "♠", red: false },
  h: { pip: "♥", red: true },
  d: { pip: "♦", red: true },
  c: { pip: "♣", red: false },
};

/**
 * Pick concrete cards for a hand class.
 *
 * The shape dictates the constraint and there is nothing clever to do beyond
 * honouring it: a suited hand needs one suit twice, a pair and an offsuit hand
 * need two different suits. Getting that backwards would put a suited hand on
 * screen as two different suits, which is not a cosmetic error — suitedness is
 * the one fact about the suits that changes the right answer.
 *
 * Returns null for an unparseable class, matching `parseHand`: a bad hand class
 * is a data problem to surface, not a crash.
 */
export function cardsFor(
  hand: Hand,
  rng: () => number = Math.random,
): [Card, Card] | null {
  const parsed = parseHand(hand);
  if (!parsed) return null;

  const first = SUITS[Math.floor(rng() * SUITS.length)] ?? "s";

  if (parsed.shape === "suited") {
    return [
      { rank: parsed.high, suit: first },
      { rank: parsed.low, suit: first },
    ];
  }

  // A pair or an offsuit hand needs a genuinely different second suit. Drawing
  // from the remaining three rather than re-rolling means this always
  // terminates, which a retry loop on a random draw does not guarantee.
  const others = SUITS.filter((suit) => suit !== first);
  const second = others[Math.floor(rng() * others.length)] ?? others[0];

  return [
    { rank: parsed.high, suit: first },
    { rank: parsed.low, suit: second },
  ];
}
