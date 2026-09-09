import { describe, expect, it } from "vitest";
import { PLAYSTYLE } from "./playstyle";

const lines = PLAYSTYLE.flatMap((section) =>
  section.groups.flatMap((group) => group.lines),
);

describe("the playstyle sheet", () => {
  it("gives every section a unique anchor", () => {
    const ids = PLAYSTYLE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no empty sections or groups", () => {
    for (const section of PLAYSTYLE) {
      expect(section.groups.length, section.id).toBeGreaterThan(0);
      for (const group of section.groups) {
        expect(
          group.lines.length,
          `${section.id}/${group.heading}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("keys every line uniquely inside its group", () => {
    // The renderer keys rows on their text, which is fine and stays fine only
    // while no group repeats a line. React would silently drop the duplicate.
    for (const section of PLAYSTYLE) {
      for (const group of section.groups) {
        const texts = group.lines.map((l) => l.then);
        expect(new Set(texts).size, `${section.id}/${group.heading}`).toBe(
          texts.length,
        );
      }
    }
  });

  it("covers every street and the discipline around them", () => {
    // The sheet's claim is that it misses nothing. This is the crude version
    // of that: the spine of a hand, plus the parts that are not a hand.
    const ids = PLAYSTYLE.map((s) => s.id);
    for (const required of [
      "types",
      "sizing",
      "facing",
      "flop",
      "turn",
      "river",
      "big",
      "spots",
      "self",
    ]) {
      expect(ids, required).toContain(required);
    }
    // "Always true" was here and has been cut. It restated things the reader
    // already knew, and a sheet you skim past is worse than a shorter one.
    expect(ids).not.toContain("always");
  });

  it("states no opening range", () => {
    // Ranges live in the chart viewer, where they are drilled and versioned. A
    // second copy here would be a second thing to disagree with the first, and
    // prose is the copy nobody would think to update.
    //
    // Short hand lists that are *decisions* are allowed and expected — "call a
    // 3-bet only with 88+, AQ, AK" is a rule. What is banned is the shape of an
    // opening chart: a long comma-run of notation.
    const notation =
      /\b[AKQJT2-9][AKQJT2-9][so]\+?(,\s*[AKQJT2-9][AKQJT2-9][so]\+?){3,}/;
    for (const line of lines) {
      expect(notation.test(line.then), line.then).toBe(false);
    }
  });

  it("does not restate the HUD colour cut-offs", () => {
    // They live in lib/hud/stats.ts, which is what colours the badges the
    // Players drill grades you against.
    //
    // The two sets disagreed when this sheet was written, and the drill has
    // since been moved onto the playbook's numbers — so they now agree, and
    // that is exactly when a second copy is most dangerous. Agreement today is
    // not agreement after the next edit.
    const band = /\b\d{1,2}\s*[–-]\s*\d{1,2}\s*·\s*\d{1,2}/;
    for (const line of lines) {
      expect(band.test(line.then), line.then).toBe(false);
    }
  });
});
