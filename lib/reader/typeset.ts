/**
 * Turning PDF text extraction into something a person can read.
 *
 * Extraction gives you the words and destroys the prose. Every line of the
 * original becomes a separate line of output, sentences are chopped at the
 * right margin, words are split across lines with hyphens, and the running
 * header and page number sit in the middle of the text like debris. Rendered
 * as-is it is unreadable — which is why the first version of this reader showed
 * the PDF pages instead, and thereby lost the ability to typeset them at all.
 *
 * This repairs the damage without rewriting a single word. Everything here
 * either **joins**, **removes furniture**, or **marks a heading**. Nothing
 * paraphrases, reorders or "improves" the author's sentences: the promise is
 * the book's own text, and a cleanup step that quietly edited it would break
 * that promise in the least detectable way possible.
 */

/** A run of text, already joined. */
export interface Block {
  type: "heading" | "paragraph";
  text: string;
}

/**
 * How many pages a line must appear on to count as furniture.
 *
 * A running header appears on nearly every page; a sentence appears once. The
 * gap between those is enormous, so the threshold does not need to be subtle —
 * it needs to be safe. A fifth of the book sits far above any repetition real
 * prose produces and far below where a header lives.
 */
export const FURNITURE_SHARE = 0.2;

/** Below this many pages, repetition means nothing and detection is skipped. */
export const MIN_PAGES_FOR_FURNITURE = 8;

/** Lines this long are prose, never a header, whatever their repetition. */
export const MAX_FURNITURE_CHARS = 80;

/**
 * The running headers and footers of a book.
 *
 * `keys` are normalised, for matching a whole line. `raw` keeps the text as it
 * actually appears, which is what makes it possible to strip a header off the
 * front of a line extraction welded it to.
 */
export interface Furniture {
  keys: Set<string>;
  raw: Set<string>;
}

/**
 * Find the running headers and footers.
 *
 * Compared with digits stripped, so "Chapter 4 · 112" and "Chapter 4 · 113" are
 * recognised as the same piece of furniture. That is the usual shape, and the
 * reason naive matching fails on it.
 */
export function findFurniture(pages: readonly string[]): Furniture {
  const furniture: Furniture = { keys: new Set(), raw: new Set() };
  if (pages.length < MIN_PAGES_FOR_FURNITURE) return furniture;

  const counts = new Map<string, number>();
  // One representative spelling per key, for stripping a header off the front
  // of a line extraction welded it to.
  const examples = new Map<string, string>();

  for (const page of pages) {
    const lines = page
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // Only the edges of a page. A repeated line in the middle is a refrain the
    // author wrote, and deleting it would be deleting the book.
    //
    // How many lines count as an edge depends on how many there are. Taking two
    // from each end of a three-line page takes the whole page, and then every
    // line of a repetitive book looks like a header — which strips the text
    // down to nothing.
    const edges =
      lines.length >= 5
        ? [...lines.slice(0, 2), ...lines.slice(-2)]
        : lines.length >= 3
          ? [lines[0], lines[lines.length - 1]]
          : [];

    for (const line of new Set(edges)) {
      if (line.length > MAX_FURNITURE_CHARS) continue;
      const key = normaliseFurniture(line);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!examples.has(key)) examples.set(key, line);
    }
  }

  const threshold = Math.max(3, Math.ceil(pages.length * FURNITURE_SHARE));
  for (const [key, count] of counts) {
    if (count < threshold) continue;
    furniture.keys.add(key);
    const example = examples.get(key);
    // Only a spelling with no digits is safe to strip as a prefix: "Chapter 4 ·
    // 112" would otherwise never match page 113, and worse, a numberless
    // variant is the one that actually gets welded to body text.
    if (example && !/\d/.test(example)) furniture.raw.add(example);
  }

  return furniture;
}

function normaliseFurniture(line: string): string {
  return line.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * A line that is page furniture on its own terms, whatever its repetition.
 *
 * Repetition catches most running heads, but not reliably enough to depend on
 * alone: extraction can weld a header onto the body text of some pages and not
 * others, which drops its count below any sane threshold. These shapes — a bare
 * page number, "Page 12", a bare domain — are furniture in every book, so they
 * are matched outright.
 */
function isPageFurniture(line: string): boolean {
  const trimmed = line.trim();
  if (/^[\s\-–—.·|]*\d{1,4}[\s\-–—.·|]*$/.test(trimmed)) return true;
  if (/^[\s\-–—.·|]+$/.test(trimmed)) return true;
  if (/^page\s+\d{1,4}$/i.test(trimmed)) return true;
  // A line that is only a web address, optionally followed by a page number.
  return /^(https?:\/\/)?www\.\S+(\s+page\s+\d{1,4})?$/i.test(trimmed);
}

/**
 * Strip furniture that extraction welded onto a line of real text.
 *
 * The failure this exists for is visible and ugly: "Crushing The Microstakes I
 * grew up in Vancouver" — the running head and the first sentence sharing one
 * extracted line, because they sat close enough in y to be grouped together. A
 * whole-line filter cannot touch that, so the header survives into the middle
 * of the prose on every single page.
 *
 * Only the ends of a line are considered. Removing a match from the middle
 * would risk deleting the author's own words wherever a chapter title happens
 * to be quoted in the text.
 */
function stripFurnitureEdges(line: string, raw: ReadonlySet<string>): string {
  let out = line;

  for (const item of raw) {
    // Short strings are far too likely to be a real word at the edge of a
    // sentence; only strip something long enough to be unambiguous.
    if (item.length < 8) continue;
    if (out.length <= item.length) continue;

    if (out.startsWith(item)) out = out.slice(item.length).trim();
    if (out.endsWith(item)) out = out.slice(0, -item.length).trim();
  }

  // "www.example.com Page 12" footers, which arrive glued to the last sentence
  // of a page for the same reason.
  return out
    .replace(/\s*(https?:\/\/)?www\.\S+\s*(page\s+\d{1,4})?\s*$/i, "")
    .replace(/\s*page\s+\d{1,4}\s*$/i, "")
    .trim();
}

/**
 * A table-of-contents entry.
 *
 * "Facing Aggression With an Overpair . . . . . . . 203" — a title, a run of
 * leader dots, a page number. Extraction turns a contents page into dozens of
 * these, and served as something to read it is nonsense: there is no argument
 * in it to recall, and being asked to summarise it is the moment a reader
 * concludes the tool is broken.
 *
 * Matched on the leader run rather than on the number, because a real sentence
 * can end in a number but will not contain four consecutive dots.
 */
export function isContentsLine(line: string): boolean {
  return /[.·]\s*[.·]\s*[.·]\s*[.·]/.test(line);
}

/**
 * Does this line end a paragraph?
 *
 * A wrapped line runs to the right margin, so it is *long*. A line that ends a
 * paragraph stops early. Combining "ends with sentence punctuation" and "is
 * noticeably shorter than its neighbours" catches the real breaks and leaves
 * mid-sentence wraps joined — which is the failure that matters, because a
 * wrongly split sentence is far more jarring to read than a wrongly joined
 * paragraph.
 */
function endsParagraph(line: string, typicalLength: number): boolean {
  if (!/[.!?:;"'”’)]$/.test(line)) return false;
  return line.length < typicalLength * 0.85;
}

/**
 * A short line with no terminal punctuation, sitting on its own.
 *
 * The length comparison is load-bearing, not decoration. A line wrapped at the
 * right margin has no terminal punctuation *by definition*, so "unpunctuated"
 * alone matches the first line of ordinary prose and turns half the book into
 * headings. What actually separates them is that a heading stops early and a
 * wrapped line runs to the margin.
 *
 * A trailing hyphen rules it out outright: that is a word broken across lines,
 * never a title.
 *
 * Conservative throughout, because a mislabelled heading breaks the flow of the
 * text far more visibly than a heading rendered as an ordinary paragraph.
 */
function looksLikeHeading(line: string, typicalLength: number): boolean {
  if (line.length > 70) return false;
  if (/[.!?,;:]$/.test(line)) return false;
  if (/[-‐‑–]$/.test(line)) return false;
  if (line.length >= typicalLength * 0.7) return false;
  const words = line.split(/\s+/).length;
  if (words > 10 || words === 0) return false;
  return /[A-Za-z]/.test(line);
}

/**
 * Repair one page's extracted text into readable blocks.
 *
 * `furniture` comes from `findFurniture` over the whole book — a header can
 * only be recognised by its repetition, which a single page cannot show.
 */
export function typesetPage(
  page: string,
  furniture: Furniture = { keys: new Set(), raw: new Set() },
): Block[] {
  const lines = page
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isPageFurniture(line))
    .filter((line) => !isContentsLine(line))
    .filter((line) => !furniture.keys.has(normaliseFurniture(line)))
    // Runs after the whole-line filters, so it only ever sees lines that
    // survived — i.e. genuine text a header got attached to.
    .map((line) => stripFurnitureEdges(line, furniture.raw))
    .filter(Boolean);

  if (lines.length === 0) return [];

  const lengths = [...lines.map((l) => l.length)].sort((a, b) => a - b);
  const typicalLength = lengths[Math.floor(lengths.length / 2)] || 60;

  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    blocks.push({ type: "paragraph", text: joinLines(buffer) });
    buffer = [];
  };

  for (const line of lines) {
    // A heading interrupts whatever came before it.
    if (buffer.length === 0 && looksLikeHeading(line, typicalLength)) {
      blocks.push({ type: "heading", text: line });
      continue;
    }

    buffer.push(line);
    if (endsParagraph(line, typicalLength)) flush();
  }

  flush();
  return blocks;
}

/**
 * Join wrapped lines back into a paragraph.
 *
 * The hyphen rule is the one that matters: extraction leaves "continu-\nation"
 * as two lines, and joining those with a space gives "continu ation", which is
 * worse than the original damage. Only a lowercase continuation is joined — a
 * hyphen before a capital is usually a real compound split across lines.
 */
function joinLines(lines: readonly string[]): string {
  let text = "";

  for (const line of lines) {
    if (text === "") {
      text = line;
      continue;
    }
    if (/[-‐‑–]$/.test(text)) {
      // A lowercase continuation means extraction split one word: drop the
      // hyphen. A capital means the hyphen is the author's, in a real compound
      // that happened to break at the margin — keep it, but never insert a
      // space, which would turn "loose-Aggressive" into two words.
      text = /^[a-z]/.test(line)
        ? `${text.slice(0, -1)}${line}`
        : `${text}${line}`;
    } else {
      text = `${text} ${line}`;
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

/**
 * The marker a heading carries once blocks are flattened into stored text.
 *
 * Storing plain text and losing the heading/paragraph distinction was a real
 * mistake: the typesetter detects headings carefully and the reader then had no
 * way to know, so a chapter title rendered as one more paragraph and the text
 * arrived as an undifferentiated wall.
 *
 * A prefix rather than a second column, because it survives every layer between
 * here and the screen untouched, and it reads sensibly to the model too — which
 * gets the section structure for free rather than having to infer it.
 */
export const HEADING_MARKER = "## ";

/** Split stored text back into blocks for rendering. */
export function readBlocks(text: string): Block[] {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) =>
      chunk.startsWith(HEADING_MARKER)
        ? { type: "heading" as const, text: chunk.slice(HEADING_MARKER.length) }
        : { type: "paragraph" as const, text: chunk },
    );
}

/**
 * Clean every page of a book, ready for splitting and reading.
 *
 * Pages stay pages — the array length and order are preserved, blanks included
 * — because page numbers have to keep matching the book. Only the text inside
 * each one changes, from a pile of fragments into paragraphs separated by blank
 * lines, with headings marked.
 */
export function typesetBook(pages: readonly string[]): string[] {
  const furniture = findFurniture(pages);

  return pages.map((page) =>
    typesetPage(page, furniture)
      .map((block) =>
        block.type === "heading"
          ? `${HEADING_MARKER}${block.text}`
          : block.text,
      )
      .join("\n\n"),
  );
}
