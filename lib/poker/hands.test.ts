import { describe, expect, it } from "vitest";
import {
  allHands,
  combosOf,
  formatRange,
  parseHand,
  parseRange,
  rangeCombos,
  rangePercent,
} from "./hands";

describe("the 169 hand classes", () => {
  it("has exactly 169 of them", () => {
    expect(allHands()).toHaveLength(169);
  });

  it("covers all 1,326 combinations exactly once", () => {
    // The classic sanity check: 13 pairs x 6 + 78 suited x 4 + 78 offsuit x 12.
    // If this fails the grid itself is wrong and nothing downstream can be right.
    const total = allHands().reduce((sum, h) => sum + combosOf(h), 0);
    expect(total).toBe(1326);
  });

  it("produces no duplicates", () => {
    const hands = allHands();
    expect(new Set(hands).size).toBe(hands.length);
  });
});

describe("parseHand", () => {
  it("normalises card order", () => {
    expect(parseHand("KAs")?.hand).toBe("AKs");
    expect(parseHand("2As")?.hand).toBe("A2s");
  });

  it("is case insensitive", () => {
    expect(parseHand("aKS")?.hand).toBe("AKs");
    expect(parseHand("akO")?.hand).toBe("AKo");
  });

  it("assigns the right combo counts", () => {
    expect(parseHand("AA")?.combos).toBe(6);
    expect(parseHand("AKs")?.combos).toBe(4);
    expect(parseHand("AKo")?.combos).toBe(12);
  });

  it("rejects a suited or offsuit pair", () => {
    // "AAs" is not a hand — treating it as AA would silently widen a range.
    expect(parseHand("AAs")).toBeNull();
    expect(parseHand("AAo")).toBeNull();
  });

  it("rejects malformed input rather than guessing", () => {
    expect(parseHand("")).toBeNull();
    expect(parseHand("A")).toBeNull();
    expect(parseHand("AXs")).toBeNull();
    expect(parseHand("AKx")).toBeNull();
    expect(parseHand("AKsx")).toBeNull();
    expect(parseHand("AK")).toBeNull(); // a non-pair must say suited or offsuit
  });
});

describe("parseRange — singletons and weights", () => {
  it("parses a bare hand", () => {
    expect([...parseRange("AA").keys()]).toEqual(["AA"]);
  });

  it("splits on commas and whitespace alike", () => {
    const byComma = parseRange("AA,KK,AKs");
    const bySpace = parseRange("AA KK AKs");
    expect([...byComma.keys()].sort()).toEqual([...bySpace.keys()].sort());
  });

  it("defaults weight to 1 and honours an explicit weight", () => {
    expect(parseRange("AA").get("AA")).toBe(1);
    expect(parseRange("AA:0.5").get("AA")).toBe(0.5);
  });

  it("keeps the widest weight when a hand appears twice", () => {
    // Overlapping groups are normal in authored charts; the broader intent
    // should win rather than whichever token happened to be written last.
    expect(parseRange("AA:0.25,AA:0.75").get("AA")).toBe(0.75);
    expect(parseRange("AA:0.75,AA:0.25").get("AA")).toBe(0.75);
  });

  it("rejects an out-of-bounds weight", () => {
    expect(() => parseRange("AA:1.5")).toThrow(/weight/i);
    expect(() => parseRange("AA:-1")).toThrow(/weight/i);
    expect(() => parseRange("AA:abc")).toThrow(/weight/i);
  });

  it("throws on a malformed hand instead of skipping it", () => {
    // Silently dropping a typo would produce a range quietly missing hands,
    // which is far worse in authored chart data than a loud failure.
    expect(() => parseRange("AA,XX")).toThrow(/invalid hand/i);
  });
});

describe("parseRange — plus ranges", () => {
  it("expands pairs upward", () => {
    expect([...parseRange("TT+").keys()].sort()).toEqual(
      ["AA", "JJ", "KK", "QQ", "TT"].sort(),
    );
  });

  it("raises the kicker for a non-connector", () => {
    expect([...parseRange("AJs+").keys()].sort()).toEqual(
      ["AJs", "AQs", "AKs"].sort(),
    );
  });

  it("raises the kicker all the way for A2s+", () => {
    const hands = parseRange("A2s+");
    expect(hands.size).toBe(12); // A2s through AKs
    expect(hands.has("A2s")).toBe(true);
    expect(hands.has("AKs")).toBe(true);
  });

  it("preserves the gap for a connector, walking both cards up", () => {
    // The one place the two conventions differ. Kicker-raising would make
    // T9s+ mean only T9s, which is never what anyone writes it for.
    expect([...parseRange("T9s+").keys()].sort()).toEqual(
      ["AKs", "JTs", "KQs", "QJs", "T9s"].sort(),
    );
  });

  it("treats a one-gapper as kicker-raising", () => {
    expect([...parseRange("97s+").keys()].sort()).toEqual(["97s", "98s"].sort());
  });

  it("handles offsuit plus ranges the same way", () => {
    expect([...parseRange("ATo+").keys()].sort()).toEqual(
      ["AJo", "AQo", "AKo", "ATo"].sort(),
    );
  });
});

describe("parseRange — dash ranges", () => {
  it("expands a pair range in either direction", () => {
    const expected = ["88", "99", "TT", "JJ", "QQ"].sort();
    expect([...parseRange("QQ-88").keys()].sort()).toEqual(expected);
    expect([...parseRange("88-QQ").keys()].sort()).toEqual(expected);
  });

  it("walks the kicker for a suited range", () => {
    expect([...parseRange("A9s-A6s").keys()].sort()).toEqual(
      ["A6s", "A7s", "A8s", "A9s"].sort(),
    );
  });

  it("rejects a range that changes hand shape", () => {
    expect(() => parseRange("A9s-A6o")).toThrow(/shape/i);
  });

  it("rejects a range that changes the high card", () => {
    // "A9s-K6s" has no single sensible reading, so it must not get one.
    expect(() => parseRange("A9s-K6s")).toThrow(/high card/i);
  });
});

describe("range measurement", () => {
  it("counts combos with weights applied", () => {
    expect(rangeCombos(parseRange("AA"))).toBe(6);
    expect(rangeCombos(parseRange("AKs"))).toBe(4);
    expect(rangeCombos(parseRange("AKo"))).toBe(12);
    expect(rangeCombos(parseRange("AA:0.5"))).toBe(3);
  });

  it("reports the whole grid as 100%", () => {
    const everything = parseRange(allHands().join(","));
    expect(rangePercent(everything)).toBeCloseTo(100, 6);
  });

  it("counts a known opening range combo-exactly", () => {
    // 77+, ATs+, KQs, AJo+ is a recognisable tight open, worked by hand:
    //   77+   8 pairs  x  6 = 48
    //   ATs+  4 suited x  4 = 16
    //   KQs   1 suited x  4 =  4
    //   AJo+  3 offsuit x 12 = 36
    //                        ---
    //                        104 combos = 7.84% of 1,326
    // Asserting the exact count catches combo-weighting errors that a
    // hand-count check would miss entirely — 104 hands and 104 combos are
    // very different things.
    const range = parseRange("77+,ATs+,KQs,AJo+");
    expect(rangeCombos(range)).toBe(104);
    expect(rangePercent(range)).toBeCloseTo(7.84, 2);
  });
});

describe("against a published range calculator", () => {
  /**
   * Two ranges BlackRain79 publishes *with* the percentage Flopzilla gives
   * them, which makes them a free external oracle for this parser.
   *
   * Everything the app says about a range — every "36.3% of hands", every
   * comparison between two seats, the whole argument that one chart is too
   * wide — is downstream of this expansion being right. Checking it against
   * our own arithmetic proves only that we are self-consistent. These two
   * strings are the one place a third party has published both the notation
   * and the answer, so they are worth more than any number of internal tests.
   *
   * Note the convention: this is standard notation, where `A5s+` is suited
   * only. The book's *chart* uses its own Note #2 convention, in which an `o`
   * suffix means both ways — a different document with different rules, and
   * the reason that chart is transcribed longhand rather than pasted in.
   */
  it("matches his stated full-ring average of 15.23%", () => {
    const range = parseRange("22+, A5s+, KTs+, QJs, AJo+, KJo+, QJo");
    expect(rangeCombos(range)).toBe(202);
    expect(rangePercent(range)).toBeCloseTo(15.23, 2);
  });

  it("matches his stated 6-max average of 20.06%", () => {
    const range = parseRange("22+, A2s+, K9s+, Q9s+, JTs, A9o+, KTo+, QJo");
    expect(rangeCombos(range)).toBe(266);
    expect(rangePercent(range)).toBeCloseTo(20.06, 2);
  });
});

describe("formatRange", () => {
  it("round-trips through the parser", () => {
    const original = parseRange("TT+,AJs+,KQs,AQo+");
    const reparsed = parseRange(formatRange(original));
    expect([...reparsed.keys()].sort()).toEqual([...original.keys()].sort());
  });

  it("round-trips weights", () => {
    const original = parseRange("AA:0.5,KK");
    const reparsed = parseRange(formatRange(original));
    expect(reparsed.get("AA")).toBe(0.5);
    expect(reparsed.get("KK")).toBe(1);
  });

  it("omits zero-weight hands", () => {
    expect(formatRange(parseRange("AA:0"))).toBe("");
  });
});
