import { describe, expect, it } from "vitest";
import { MAX_PAGES, MIN_WORDS, segment } from "./segment";

/** A page of `words` filler words, optionally led by a heading line. */
function page(words: number, heading?: string): string {
  const body = Array.from({ length: words }, () => "word").join(" ");
  return heading ? `${heading}\n${body}` : body;
}

/** Every page number a set of passages covers, in order. */
function covered(passages: ReturnType<typeof segment>): number[] {
  return passages.flatMap((p) =>
    Array.from(
      { length: p.lastPage - p.firstPage + 1 },
      (_, i) => p.firstPage + i,
    ),
  );
}

describe("splitting a book into portions", () => {
  it("closes a portion once it has enough words", () => {
    const passages = segment([page(400), page(400), page(400)], 1000);

    // Pages are atomic, so it overshoots to 1200 rather than cutting page 3.
    expect(passages).toHaveLength(1);
    expect(passages[0].firstPage).toBe(1);
    expect(passages[0].lastPage).toBe(3);
    expect(passages[0].wordCount).toBe(1200);
  });

  it("covers every page exactly once, in order", () => {
    const passages = segment([page(600), page(600), page(600), page(600)], 1000);
    expect(covered(passages)).toEqual([1, 2, 3, 4]);
  });

  it("caps a portion by page count when the pages are nearly empty", () => {
    // Twelve pages of charts with a caption each: by word count alone this
    // would be one portion covering the lot.
    const passages = segment(
      Array.from({ length: 12 }, () => page(5)),
      1000,
    );

    expect(passages[0].lastPage).toBe(MAX_PAGES);
    expect(passages.length).toBeGreaterThan(1);
    // The cap outranks the short-tail merge. Merging here would silently hand
    // back a twelve-page portion, which is the thing the cap exists to prevent.
    for (const passage of passages) {
      expect(passage.lastPage - passage.firstPage + 1).toBeLessThanOrEqual(
        MAX_PAGES,
      );
    }
  });

  it("merges a short final portion into the one before it", () => {
    const passages = segment([page(1000), page(1000), page(30)], 1000);

    // A thirty-word last portion would ask you to recall almost nothing, which
    // reads as the app breaking on the final thing you do.
    expect(passages).toHaveLength(2);
    expect(passages[1].lastPage).toBe(3);
    expect(passages[1].wordCount).toBeGreaterThan(MIN_WORDS);
  });

  it("leaves a single short book alone rather than merging it into nothing", () => {
    const passages = segment([page(40)], 1000);

    expect(passages).toHaveLength(1);
    expect(passages[0].wordCount).toBe(40);
  });

  it("numbers portions in reading order", () => {
    const passages = segment([page(1000), page(1000), page(1000)], 1000);
    expect(passages.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it("keeps blank pages so the numbering matches the book", () => {
    const passages = segment([page(1000), "", page(1000)], 1000);
    expect(covered(passages)).toContain(2);
  });

  it("handles an empty book without inventing a portion", () => {
    expect(segment([], 1000)).toEqual([]);
  });
});

describe("labelling where you are", () => {
  it("picks up an explicit chapter marker", () => {
    const passages = segment([page(1000, "Chapter 4: Blind Defence")], 1000);
    expect(passages[0].heading).toBe("Chapter 4: Blind Defence");
  });

  it("accepts a short unpunctuated opening line as a heading", () => {
    const passages = segment([page(1000, "Defending the big blind")], 1000);
    expect(passages[0].heading).toBe("Defending the big blind");
  });

  it("refuses to treat a sentence as a heading", () => {
    // A wrong heading is worse than none: it tells you confidently that you are
    // somewhere you are not.
    const passages = segment(
      [page(1000, "This chapter argues that folding too often is expensive.")],
      1000,
    );
    expect(passages[0].heading).toBeUndefined();
  });

  it("refuses a bare page number", () => {
    const passages = segment([page(1000, "217")], 1000);
    expect(passages[0].heading).toBeUndefined();
  });
});
