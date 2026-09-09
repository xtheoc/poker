import { describe, expect, it } from "vitest";
import {
  type OutlineEntry,
  outlineProbe,
  portionsForSections,
  sectionsFromOutline,
} from "./sections";

function page(words: number, heading?: string): string {
  const body = Array.from({ length: words }, () => "word").join(" ");
  return heading ? `${heading}\n${body}` : body;
}

function entry(title: string, page: number, level = 0): OutlineEntry {
  return { title, page, level };
}

describe("taking structure from the book's own outline", () => {
  it("runs each section up to the page before the next starts", () => {
    const sections = sectionsFromOutline(
      [entry("One", 1), entry("Two", 11), entry("Three", 21)],
      30,
    );

    expect(sections.map((s) => [s.title, s.firstPage, s.lastPage])).toEqual([
      ["One", 1, 10],
      ["Two", 11, 20],
      ["Three", 21, 30],
    ]);
  });

  it("keeps front matter as an untitled opening section", () => {
    // Dropping it would make every page number the reader shows disagree with
    // the page numbers printed in the book.
    const sections = sectionsFromOutline([entry("One", 5)], 10);

    expect(sections[0]).toMatchObject({
      title: null,
      firstPage: 1,
      lastPage: 4,
    });
    expect(sections[1]).toMatchObject({
      title: "One",
      firstPage: 5,
      lastPage: 10,
    });
  });

  it("ignores outline entries nested too deep to be a section", () => {
    // A level-3 bookmark is a sub-heading — a paragraph and a half, with
    // nothing in it worth being asked to recall.
    const sections = sectionsFromOutline(
      [entry("Chapter", 1), entry("A sub-point", 3, 3)],
      10,
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].lastPage).toBe(10);
  });

  it("merges two entries that point at the same page", () => {
    // A chapter and its first heading both land on the chapter's opening page;
    // splitting between them would produce a section of zero pages. Two
    // sections is the correct answer here, not one — the front matter before
    // page 7 is the other. Three would mean the merge failed.
    const sections = sectionsFromOutline(
      [entry("Chapter 2", 7), entry("Why position matters", 7, 1)],
      12,
    );

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ title: null, firstPage: 1, lastPage: 6 });
    expect(sections[1]).toMatchObject({
      title: "Chapter 2",
      firstPage: 7,
      lastPage: 12,
    });
  });

  it("drops entries pointing outside the book", () => {
    const sections = sectionsFromOutline(
      [entry("Real", 2), entry("Broken", 999)],
      10,
    );

    expect(sections.map((s) => s.title)).toEqual([null, "Real"]);
  });

  it("falls back to one whole-book section when the outline is unusable", () => {
    expect(sectionsFromOutline([entry("  ", 1)], 10)).toEqual([
      { index: 0, title: null, firstPage: 1, lastPage: 10 },
    ]);
  });

  it("has nothing to say about an empty book", () => {
    expect(sectionsFromOutline([entry("One", 1)], 0)).toEqual([]);
  });
});

describe("cutting sections into portions", () => {
  const pages = Array.from({ length: 12 }, () => page(600));

  it("never lets a portion cross a section boundary", () => {
    const sections = sectionsFromOutline([entry("A", 1), entry("B", 7)], 12);
    const portions = portionsForSections(sections, pages, 1000);

    for (const portion of portions) {
      const section = sections[portion.sectionIndex];
      expect(portion.firstPage).toBeGreaterThanOrEqual(section.firstPage);
      expect(portion.lastPage).toBeLessThanOrEqual(section.lastPage);
    }
  });

  it("reports page numbers in the book's own numbering", () => {
    const sections = sectionsFromOutline([entry("A", 1), entry("B", 7)], 12);
    const portions = portionsForSections(sections, pages, 1000);

    // The first portion of section B starts at page 7, not page 1 of its slice.
    expect(portions.find((p) => p.sectionIndex === 1)?.firstPage).toBe(7);
  });

  it("keeps a short section whole rather than padding it", () => {
    // A two-page section is a complete thought. Filling it out with the start
    // of the next chapter would undo the reason for sectioning at all.
    const sections = sectionsFromOutline(
      [entry("Short", 1), entry("Next", 3)],
      12,
    );
    const short = portionsForSections(sections, pages, 1000).filter(
      (p) => p.sectionIndex === 0,
    );

    expect(short).toHaveLength(1);
    expect(short[0].lastPage).toBe(2);
  });

  it("labels every portion with its section, and numbers them in order", () => {
    const sections = sectionsFromOutline([entry("A", 1), entry("B", 7)], 12);
    const portions = portionsForSections(sections, pages, 1000);

    expect(portions.map((p) => p.index)).toEqual(portions.map((_, i) => i));
    expect(portions.find((p) => p.sectionIndex === 1)?.sectionTitle).toBe("B");
  });

  it("prefers the book's section title over a guessed heading", () => {
    const portions = portionsForSections(
      [{ index: 0, title: "Chapter 4", firstPage: 1, lastPage: 1 }],
      [page(1000, "Some Line That Looks Like A Heading")],
      1000,
    );

    expect(portions[0].heading).toBe("Chapter 4");
  });
});

describe("the map sent to a model when there is no outline", () => {
  it("keeps the opening lines and drops the bulk", () => {
    const probe = outlineProbe([page(500, "Chapter 1"), page(500, "Chapter 2")]);

    expect(probe).toContain("p1: Chapter 1");
    expect(probe).toContain("p2: Chapter 2");
    // The point is that it stays small: full text would be hundreds of times
    // this, for no extra structural signal.
    expect(probe.length).toBeLessThan(500);
  });

  it("marks blank pages rather than omitting them", () => {
    // Page numbers have to keep lining up with the book.
    expect(outlineProbe([page(10), "", page(10)])).toContain("p2: (blank)");
  });
});
