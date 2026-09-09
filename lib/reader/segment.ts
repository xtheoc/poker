/**
 * Splitting a book into portions.
 *
 * The most consequential decision in the reader, because the portion is the
 * thing you actually sit down to. Too long and every session is a slog you
 * avoid starting; too short and the recall question at the end is trivial and
 * teaches nothing.
 *
 * Three rules, and the reasoning for each.
 *
 * **Pages are atomic.** A passage never starts or ends mid-page, because what
 * you read is the *rendered page* — diagrams, range grids and all — and telling
 * someone to stop two-thirds of the way down a page is an instruction nobody
 * follows.
 *
 * **Length is measured in words, not pages.** Poker books swing from a dense
 * page of prose to a page that is one chart. Ten pages is meaningless as a
 * unit; a thousand words is roughly a consistent amount of thinking.
 *
 * **A short final portion is merged rather than left alone.** A book ending on
 * a forty-word passage produces a recall prompt with nothing in it to recall,
 * which reads as the app breaking on the very last thing you do.
 */

/**
 * Words per portion.
 *
 * About ten minutes of careful reading of dense material and — more to the
 * point — about as much as anyone can actually reproduce from memory in one go.
 * The recall gate is the binding constraint here, not reading speed: a portion
 * you could not summarise is a portion the gate cannot fairly ask about.
 */
export const TARGET_WORDS = 1000;

/**
 * Hard ceiling on pages per portion.
 *
 * Protects against a run of chart-heavy pages with almost no extractable text,
 * which by word count alone would be swallowed into one enormous portion.
 */
export const MAX_PAGES = 8;

/** Below this, a trailing portion is merged into the one before it. */
export const MIN_WORDS = 250;

export interface Passage {
  index: number;
  /** One-based, matching what the PDF viewer shows. */
  firstPage: number;
  lastPage: number;
  heading?: string;
  text: string;
  wordCount: number;
}

/**
 * Split extracted page text into portions.
 *
 * `pages[0]` is page 1. Empty pages are kept rather than dropped — a blank page
 * inside a chapter still has to be rendered, or the page numbers stop matching
 * the book in your hands.
 */
export function segment(
  pages: readonly string[],
  targetWords = TARGET_WORDS,
): Passage[] {
  const passages: Passage[] = [];

  let startPage = 1;
  let buffer: string[] = [];
  let words = 0;

  const flush = (endPage: number) => {
    if (buffer.length === 0) return;
    passages.push({
      index: passages.length,
      firstPage: startPage,
      lastPage: endPage,
      heading: findHeading(buffer[0]),
      text: buffer.join("\n\n").trim(),
      wordCount: words,
    });
    buffer = [];
    words = 0;
    startPage = endPage + 1;
  };

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] ?? "";
    buffer.push(page);
    words += countWords(page);

    if (words >= targetWords || buffer.length >= MAX_PAGES) flush(i + 1);
  }

  flush(pages.length);

  return mergeShortTail(passages);
}

/**
 * Fold a too-short final portion into its predecessor.
 *
 * Only the tail can need this: the loop above closes a portion only when it is
 * full, so a short one in the middle cannot occur.
 *
 * The page-span guard is load-bearing rather than defensive. In a chart-heavy
 * book every portion is short on words *by design* — that is what the page cap
 * is for — and merging the tail into an already page-capped portion would quietly
 * undo the cap and hand you a portion twice the intended length. When the two
 * rules disagree, the cap wins and a short final portion is simply allowed.
 */
function mergeShortTail(passages: Passage[]): Passage[] {
  if (passages.length < 2) return passages;

  const last = passages[passages.length - 1];
  if (last.wordCount >= MIN_WORDS) return passages;

  const previous = passages[passages.length - 2];
  if (last.lastPage - previous.firstPage + 1 > MAX_PAGES) return passages;

  const merged: Passage = {
    ...previous,
    lastPage: last.lastPage,
    text: `${previous.text}\n\n${last.text}`.trim(),
    wordCount: previous.wordCount + last.wordCount,
  };

  return [...passages.slice(0, -2), merged];
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * A best-effort label for where in the book you are.
 *
 * Deliberately conservative: a wrong heading is worse than none, because it
 * tells you confidently that you are somewhere you are not. Only lines that
 * look unmistakably like headings qualify — an explicit chapter marker, or a
 * short opening line carrying no terminal punctuation.
 */
function findHeading(firstPage: string | undefined): string | undefined {
  if (!firstPage) return undefined;

  const lines = firstPage
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  for (const line of lines) {
    if (/^(chapter|part|section)\s+([0-9]+|[ivxl]+)\b/i.test(line)) {
      return line.slice(0, 120);
    }
  }

  const first = lines[0];
  if (!first) return undefined;

  const words = first.split(/\s+/).length;
  const looksLikeHeading =
    words <= 8 && !/[.!?,;:]$/.test(first) && !/^\d+$/.test(first);

  return looksLikeHeading ? first.slice(0, 120) : undefined;
}
