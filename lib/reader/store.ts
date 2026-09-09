/**
 * Books and passages, as they live in the database.
 *
 * The gate is enforced here rather than in the page, because a rule that only
 * exists in a React component is a rule anyone can step around by editing a
 * URL. `unlockedIndex` is the one definition of how far you may read, and every
 * caller derives from it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Enrichment } from "./ai";
import type { SectionedPassage } from "./sections";

/**
 * The database is behind the code: a table or a column this needs is missing.
 *
 * Named for tables because that is what it originally caught, and kept that way
 * because four call sites test it by name — but a missing *column* is the same
 * situation and deserved the same answer from the start. It did not get one,
 * and the result was a stack trace reading "column passage.figure_pages does
 * not exist" on a page whose fix is one file and ten seconds.
 *
 * A migration that adds a column is in fact the more likely of the two to be
 * skipped: the tables get created once, during setup, while later migrations
 * arrive one at a time alongside features and are easy to miss.
 */
export class MissingReaderTableError extends Error {
  /** The migration that supplies what is missing. */
  readonly migration: string;

  constructor(migration = "supabase/migrations/0005_reader.sql") {
    super(`The reader database is missing something ${migration} creates.`);
    this.name = "MissingReaderTableError";
    this.migration = migration;
  }
}

/**
 * Which migration supplies a column, so the message can name one file.
 *
 * Only columns added *after* the reader's own migration need an entry: anything
 * missing that is not listed here means the tables themselves were never
 * created, which is `0005_reader.sql`.
 */
const COLUMN_MIGRATIONS: ReadonlyArray<[RegExp, string]> = [
  [/figure_pages/, "supabase/migrations/0008_figures.sql"],
  [
    /\b(attempts|complete_at|missing)\b/,
    "supabase/migrations/0007_reading_limit.sql",
  ],
  [
    /\b(section_index|section_title|enrichment)\b/,
    "supabase/migrations/0006_reader_ai.sql",
  ],
];

function missingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table/i.test(error.message ?? "")
  );
}

/** PostgREST reports an unknown column two different ways depending on path. */
function missingColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|Could not find the '.*' column/i.test(
      error.message ?? "",
    )
  );
}

function fail(
  error: { code?: string; message?: string },
  context: string,
): never {
  if (missingTable(error)) throw new MissingReaderTableError();

  if (missingColumn(error)) {
    const message = error.message ?? "";
    const match = COLUMN_MIGRATIONS.find(([pattern]) => pattern.test(message));
    throw new MissingReaderTableError(match?.[1]);
  }

  throw new Error(`${context}: ${error.message}`);
}

export type BookStatus = "processing" | "ready" | "failed";

export interface Book {
  id: string;
  title: string;
  author: string | null;
  curriculumId: string | null;
  storagePath: string;
  pageCount: number | null;
  status: BookStatus;
  error: string | null;
}

export interface Passage {
  id: string;
  index: number;
  firstPage: number;
  lastPage: number;
  heading: string | null;
  text: string;
  wordCount: number;
  sectionIndex: number | null;
  sectionTitle: string | null;
  enrichment: Enrichment | null;
  recallText: string | null;
  recalledAt: Date | null;
  score: number | null;
  missed: string | null;
  /** How many summaries have been written for this portion. */
  attempts: number;
  /** Set once the summary covered the passage. This is what opens the next. */
  completeAt: Date | null;
  /** What the last attempt left out. */
  missing: string[] | null;
  /** Pages in this portion that carry an image the text extraction cannot show. */
  figurePages: number[] | null;
}

/** One rule the book taught, as it would be said at a table. */
export interface BookNote {
  id: string;
  passageIndex: number;
  sectionTitle: string | null;
  rule: string;
  sourcePages: string | null;
}

interface BookRow {
  id: string;
  title: string;
  author: string | null;
  curriculum_id: string | null;
  storage_path: string;
  page_count: number | null;
  status: BookStatus;
  error: string | null;
}

interface PassageRow {
  id: string;
  index: number;
  first_page: number;
  last_page: number;
  heading: string | null;
  text: string;
  word_count: number;
  section_index: number | null;
  section_title: string | null;
  enrichment: Enrichment | null;
  recall_text: string | null;
  recalled_at: string | null;
  score: number | null;
  missed: string | null;
  attempts: number;
  complete_at: string | null;
  missing: string[] | null;
  figure_pages: number[] | null;
}

interface NoteRow {
  id: string;
  passage_index: number;
  section_title: string | null;
  rule: string;
  source_pages: string | null;
}

const BOOK_COLUMNS =
  "id, title, author, curriculum_id, storage_path, page_count, status, error";
const PASSAGE_COLUMNS =
  "id, index, first_page, last_page, heading, text, word_count, " +
  "section_index, section_title, enrichment, " +
  "recall_text, recalled_at, score, missed, attempts, complete_at, missing, " +
  "figure_pages";

const NOTE_COLUMNS = "id, passage_index, section_title, rule, source_pages";

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    curriculumId: row.curriculum_id,
    storagePath: row.storage_path,
    pageCount: row.page_count,
    status: row.status,
    error: row.error,
  };
}

function toPassage(row: PassageRow): Passage {
  return {
    id: row.id,
    index: row.index,
    firstPage: row.first_page,
    lastPage: row.last_page,
    heading: row.heading,
    text: row.text,
    wordCount: row.word_count,
    sectionIndex: row.section_index,
    sectionTitle: row.section_title,
    enrichment: row.enrichment,
    recallText: row.recall_text,
    recalledAt: row.recalled_at ? new Date(row.recalled_at) : null,
    score: row.score,
    missed: row.missed,
    attempts: row.attempts ?? 0,
    completeAt: row.complete_at ? new Date(row.complete_at) : null,
    missing: row.missing,
    figurePages: row.figure_pages,
  };
}

/** Your shelf, newest first. */
export async function loadBooks(
  supabase: SupabaseClient,
  userId: string,
): Promise<Book[]> {
  const { data, error } = await supabase
    .from("book")
    .select(BOOK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) fail(error, "Could not load your books");
  return ((data ?? []) as unknown as BookRow[]).map(toBook);
}

/** How far through a book you are. */
export interface BookProgress {
  total: number;
  done: number;
}

/**
 * Progress for every book at once, for the shelf.
 *
 * Selects two columns and no text. A shelf needs counts, and a book's full text
 * runs to megabytes — fetching all of it to compute "12 of 46" would make the
 * list slower to open than the reading itself.
 */
export async function loadProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, BookProgress>> {
  const { data, error } = await supabase
    .from("passage")
    .select("book_id, complete_at")
    .eq("user_id", userId);

  if (error) fail(error, "Could not load your progress");

  const progress = new Map<string, BookProgress>();
  for (const row of (data ?? []) as Array<{
    book_id: string;
    complete_at: string | null;
  }>) {
    const entry = progress.get(row.book_id) ?? { total: 0, done: 0 };
    entry.total++;
    if (row.complete_at) entry.done++;
    progress.set(row.book_id, entry);
  }

  return progress;
}

export async function loadBook(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
): Promise<Book | null> {
  const { data, error } = await supabase
    .from("book")
    .select(BOOK_COLUMNS)
    .eq("user_id", userId)
    .eq("id", bookId)
    .maybeSingle();

  if (error) fail(error, "Could not load that book");
  return data ? toBook(data as unknown as BookRow) : null;
}

/**
 * Every passage in a book, in order.
 *
 * The full text comes back with them. That is a lot of rows on a long book, and
 * it is still the right call: the contents list needs headings and progress
 * anyway, and the alternative is a second round trip on every page turn.
 */
export async function loadPassages(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
): Promise<Passage[]> {
  const { data, error } = await supabase
    .from("passage")
    .select(PASSAGE_COLUMNS)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("index", { ascending: true });

  if (error) fail(error, "Could not load that book's passages");
  return ((data ?? []) as unknown as PassageRow[]).map(toPassage);
}

/**
 * The furthest passage you may open.
 *
 * The first portion whose summary has not yet covered the passage. Portion zero
 * is always available; everything after it waits on the one before being
 * *complete*, not merely attempted.
 *
 * That is the change the whole redesign turns on. Opening the next portion on
 * any attempt made the writing a formality you could type one line into; making
 * it wait until nothing is missing is what turns it into recall practice you
 * actually repeat.
 */
export function unlockedIndex(passages: readonly Passage[]): number {
  const first = passages.findIndex((p) => p.completeAt === null);
  return first === -1 ? Math.max(passages.length - 1, 0) : first;
}

/**
 * Pages finished on a given local date.
 *
 * Counted from completed portions rather than opened ones, so the limit tracks
 * reading you actually took in. Dates are compared in the reader's own timezone
 * — a portion finished at 1am should count for the night it felt like, not for
 * whatever calendar day the server is in.
 */
export function pagesReadOn(
  passages: readonly Passage[],
  localDate: string,
  timezone: string,
): number {
  return passages
    .filter((p) => p.completeAt && dateIn(p.completeAt, timezone) === localDate)
    .reduce((sum, p) => sum + (p.lastPage - p.firstPage + 1), 0);
}

function dateIn(at: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** Replace a book's passages with a freshly segmented set. */
export async function savePassages(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  passages: ReadonlyArray<SectionedPassage & { figurePages?: number[] }>,
): Promise<void> {
  // Cleared first, so re-importing cannot leave the tail of a longer previous
  // split orphaned behind the new one.
  const { error: clearError } = await supabase
    .from("passage")
    .delete()
    .eq("user_id", userId)
    .eq("book_id", bookId);
  if (clearError) fail(clearError, "Could not clear the old split");

  const rows = passages.map((p) => ({
    user_id: userId,
    book_id: bookId,
    index: p.index,
    first_page: p.firstPage,
    last_page: p.lastPage,
    heading: p.heading ?? null,
    text: p.text,
    word_count: p.wordCount,
    section_index: p.sectionIndex,
    section_title: p.sectionTitle,
    figure_pages: p.figurePages ?? null,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase
      .from("passage")
      .insert(rows.slice(i, i + 100));
    if (error) fail(error, "Could not save the split");
  }
}

export async function createBook(
  supabase: SupabaseClient,
  userId: string,
  book: {
    title: string;
    author?: string | null;
    curriculumId?: string | null;
    storagePath: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("book")
    .insert({
      user_id: userId,
      title: book.title,
      author: book.author ?? null,
      curriculum_id: book.curriculumId ?? null,
      storage_path: book.storagePath,
      status: "processing",
    })
    .select("id")
    .single();

  if (error) fail(error, "Could not add that book");
  return (data as { id: string }).id;
}

export async function markBook(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  patch: { status: BookStatus; pageCount?: number; error?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("book")
    .update({
      status: patch.status,
      page_count: patch.pageCount ?? null,
      error: patch.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .eq("user_id", userId);

  if (error) fail(error, "Could not update that book");
}

/**
 * Record one attempt at summarising a portion.
 *
 * `complete_at` is only ever set, never cleared. Once a portion has been
 * covered it stays covered — rereading it later and writing something thinner
 * must not close a section you already finished, or the book could un-finish
 * itself behind you.
 */
export async function saveReview(
  supabase: SupabaseClient,
  userId: string,
  passageId: string,
  review: {
    text: string;
    attempts: number;
    complete: boolean;
    score?: number | null;
    missing?: string[] | null;
  },
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("passage")
    .update({
      recall_text: review.text,
      recalled_at: now,
      attempts: review.attempts,
      score: review.score ?? null,
      missing: review.missing ?? null,
      ...(review.complete ? { complete_at: now } : {}),
    })
    .eq("id", passageId)
    .eq("user_id", userId);

  if (error) fail(error, "Could not save that");
}

/**
 * Cache the model's pass over one portion.
 *
 * Written once and reused, because enrichment is deterministic enough not to be
 * worth paying for twice and slow enough that re-running it on every visit
 * would make revisiting a portion feel broken.
 */
export async function saveEnrichment(
  supabase: SupabaseClient,
  userId: string,
  passageId: string,
  enrichment: Enrichment,
): Promise<void> {
  const { error } = await supabase
    .from("passage")
    .update({ enrichment, enriched_at: new Date().toISOString() })
    .eq("id", passageId)
    .eq("user_id", userId);

  if (error) fail(error, "Could not save those notes");
}

/** The playbook so far, in reading order. */
/**
 * How many rules each book has produced, for the shelf.
 *
 * One grouped query rather than a `loadNotes` per book, for the same reason
 * `loadProgress` exists: a shelf of eight books would otherwise be eight round
 * trips to render a number. Selects the key column only — the rules themselves
 * belong on the summary page, where they are actually read.
 */
export async function loadNoteCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("book_note")
    .select("book_id")
    .eq("user_id", userId);

  if (error) fail(error, "Could not count your rules");

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ book_id: string }>) {
    counts.set(row.book_id, (counts.get(row.book_id) ?? 0) + 1);
  }
  return counts;
}

export async function loadNotes(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
): Promise<BookNote[]> {
  const { data, error } = await supabase
    .from("book_note")
    .select(NOTE_COLUMNS)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("passage_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) fail(error, "Could not load the playbook");

  return ((data ?? []) as unknown as NoteRow[]).map((row) => ({
    id: row.id,
    passageIndex: row.passage_index,
    sectionTitle: row.section_title,
    rule: row.rule,
    sourcePages: row.source_pages,
  }));
}

/**
 * Add this portion's rules to the playbook.
 *
 * Existing rules for the passage are cleared first, so re-recalling a portion
 * revises its entry instead of quietly doubling it.
 */
export async function saveNotes(
  supabase: SupabaseClient,
  userId: string,
  book: { bookId: string; passageId: string; passageIndex: number },
  rules: readonly string[],
  meta: { sectionTitle: string | null; sourcePages: string },
): Promise<void> {
  const { error: clearError } = await supabase
    .from("book_note")
    .delete()
    .eq("user_id", userId)
    .eq("passage_id", book.passageId);
  if (clearError) fail(clearError, "Could not update the playbook");

  if (rules.length === 0) return;

  const { error } = await supabase.from("book_note").insert(
    rules.map((rule) => ({
      user_id: userId,
      book_id: book.bookId,
      passage_id: book.passageId,
      passage_index: book.passageIndex,
      section_title: meta.sectionTitle,
      rule,
      source_pages: meta.sourcePages,
    })),
  );

  if (error) fail(error, "Could not save the playbook");
}

/** A short-lived URL the browser can render the PDF from. */
export async function signedBookUrl(
  supabase: SupabaseClient,
  storagePath: string,
  seconds = 3600,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from("books")
    .createSignedUrl(storagePath, seconds);
  return data?.signedUrl ?? null;
}
