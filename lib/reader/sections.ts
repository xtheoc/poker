/**
 * Where a book's ideas actually begin and end.
 *
 * The first version of the reader cut every 1,000 words. It read fine and
 * taught badly, because a portion that starts three paragraphs into an argument
 * and stops before its conclusion cannot be recalled — there is no *it* to
 * recall. The unit has to be a piece of reasoning, not a quantity of text.
 *
 * Structure is taken in this order, best first:
 *
 * 1. **The book's own outline.** Most published PDFs carry bookmarks with real
 *    chapter titles and page destinations. It is the author's own sectioning,
 *    it is free, and it is exactly right. Nothing a model infers will beat it.
 * 2. **Inferred sections**, when a PDF has no outline — the model reads a map of
 *    the book and says where the parts begin.
 * 3. **Word count**, when there is nothing else to go on.
 *
 * Sections are then cut into portions, because a forty-page chapter is not a
 * sitting. A portion never crosses a section boundary: that is the whole point.
 */

import { MAX_PAGES, type Passage, TARGET_WORDS, segment } from "./segment";

/** One entry from a PDF's outline. */
export interface OutlineEntry {
  title: string;
  /** One-based page the entry points at. */
  page: number;
  /** Nesting depth, zero at the top. */
  level: number;
}

/** A named part of the book, covering a page range. */
export interface Section {
  index: number;
  title: string | null;
  firstPage: number;
  lastPage: number;
}

/**
 * How deep into the outline still counts as a section.
 *
 * Top level and one below it. Deeper than that, a "section" becomes a
 * sub-heading — a paragraph and a half, with nothing in it worth recalling.
 * Those pages are not lost; they fold into their parent.
 */
export const MAX_OUTLINE_LEVEL = 1;

/**
 * Turn a PDF outline into sections covering the whole book.
 *
 * Pages before the first outline entry become an untitled leading section
 * rather than being dropped. That is usually front matter, and it is still the
 * start of the file — skipping it would make every page number the reader
 * displays disagree with the book.
 */
export function sectionsFromOutline(
  entries: readonly OutlineEntry[],
  pageCount: number,
): Section[] {
  if (pageCount <= 0) return [];

  const usable = entries
    .filter((e) => e.level <= MAX_OUTLINE_LEVEL)
    .filter((e) => Number.isFinite(e.page) && e.page >= 1 && e.page <= pageCount)
    .map((e) => ({ ...e, title: e.title.trim() }))
    .filter((e) => e.title.length > 0)
    .sort((a, b) => a.page - b.page);

  // Two entries on one page are one section: a chapter and its first heading
  // both point at the chapter's opening page, and splitting there would create
  // a zero-page section.
  const starts: OutlineEntry[] = [];
  for (const entry of usable) {
    if (starts.length > 0 && starts[starts.length - 1].page === entry.page) {
      continue;
    }
    starts.push(entry);
  }

  if (starts.length === 0) {
    return [{ index: 0, title: null, firstPage: 1, lastPage: pageCount }];
  }

  const sections: Section[] = [];

  if (starts[0].page > 1) {
    sections.push({
      index: 0,
      title: null,
      firstPage: 1,
      lastPage: starts[0].page - 1,
    });
  }

  for (let i = 0; i < starts.length; i++) {
    const next = starts[i + 1];
    sections.push({
      index: sections.length,
      title: starts[i].title,
      firstPage: starts[i].page,
      lastPage: next ? next.page - 1 : pageCount,
    });
  }

  return sections;
}

/** A portion, plus the section it belongs to. */
export interface SectionedPassage extends Passage {
  sectionIndex: number;
  sectionTitle: string | null;
}

/**
 * Cut sections into portions.
 *
 * Each section is segmented independently, so a portion can never span two
 * ideas. A short section stays one portion however short — a two-page section
 * is a complete thought, and padding it with the start of the next chapter to
 * reach a word count would undo the whole reason for sectioning.
 */
export function portionsForSections(
  sections: readonly Section[],
  pages: readonly string[],
  targetWords = TARGET_WORDS,
): SectionedPassage[] {
  const out: SectionedPassage[] = [];

  for (const section of sections) {
    const slice = pages.slice(section.firstPage - 1, section.lastPage);
    if (slice.length === 0) continue;

    for (const passage of segment(slice, targetWords)) {
      out.push({
        ...passage,
        // segment() numbers pages from 1 within the slice it was handed; shift
        // them back into the book's own numbering.
        firstPage: passage.firstPage + section.firstPage - 1,
        lastPage: passage.lastPage + section.firstPage - 1,
        index: out.length,
        // The section title beats segment()'s guess at a heading: it comes from
        // the book itself, and a guess that contradicts the real structure is
        // worse than no guess.
        heading: section.title ?? passage.heading,
        sectionIndex: section.index,
        sectionTitle: section.title,
      });
    }
  }

  return out;
}

/**
 * A compact map of the book, for a model to infer sections from.
 *
 * Sending 540 pages of full text to ask "where do the chapters start" is both
 * unnecessary and worse: the opening lines of each page carry nearly all the
 * structural signal, and a smaller prompt makes the job easier rather than
 * harder. A chapter opening looks like a chapter opening in its first dozen
 * words.
 */
export function outlineProbe(pages: readonly string[], perPage = 160): string {
  return pages
    .map((page, i) => {
      const head = page
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(" / ")
        .slice(0, perPage);
      return `p${i + 1}: ${head || "(blank)"}`;
    })
    .join("\n");
}

export { MAX_PAGES, TARGET_WORDS };
