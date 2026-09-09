import { describe, expect, it } from "vitest";
import { SUITS, cardsFor } from "./cards";

/** A generator that walks the given values, then repeats the last one. */
function rolls(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("dealing concrete cards for a hand class", () => {
  it("gives a suited hand one suit", () => {
    const cards = cardsFor("AKs", rolls(0.3));

    expect(cards).not.toBeNull();
    expect(cards?.[0].suit).toBe(cards?.[1].suit);
    expect(cards?.[0].rank).toBe("A");
    expect(cards?.[1].rank).toBe("K");
  });

  it("gives an offsuit hand two different suits", () => {
    // Suitedness is the one property of the suits that changes the answer, so
    // an offsuit hand drawn as two matching cards would be showing a different
    // hand from the one being graded.
    const cards = cardsFor("AKo", rolls(0, 0));

    expect(cards?.[0].suit).not.toBe(cards?.[1].suit);
  });

  it("gives a pair two different suits", () => {
    const cards = cardsFor("AA", rolls(0, 0));

    expect(cards?.[0].rank).toBe("A");
    expect(cards?.[1].rank).toBe("A");
    expect(cards?.[0].suit).not.toBe(cards?.[1].suit);
  });

  it("never produces the same card twice, whatever the rolls", () => {
    // The second suit is drawn from the three that remain, so no draw can
    // collide. Worth asserting across the space rather than trusting it.
    for (const first of [0, 0.3, 0.6, 0.99]) {
      for (const second of [0, 0.5, 0.99]) {
        const cards = cardsFor("77", rolls(first, second));
        expect(`${cards?.[0].rank}${cards?.[0].suit}`).not.toBe(
          `${cards?.[1].rank}${cards?.[1].suit}`,
        );
      }
    }
  });

  it("normalises card order the way the hand notation does", () => {
    // parseHand puts the stronger rank first, so "KAs" and "AKs" are one hand.
    expect(cardsFor("KAs", rolls(0))?.[0].rank).toBe("A");
  });

  it("returns null for something that is not a hand", () => {
    expect(cardsFor("garbage")).toBeNull();
    expect(cardsFor("")).toBeNull();
  });

  it("stays inside the four suits", () => {
    for (let i = 0; i < 20; i++) {
      const cards = cardsFor("QJo");
      expect(SUITS).toContain(cards?.[0].suit);
      expect(SUITS).toContain(cards?.[1].suit);
    }
  });
});
