/**
 * Reading history, as it lives in the database.
 *
 * Thin on purpose. All the judgement — which stage you are on, what to offer
 * next, whether reading is even the right use of the hour — is pure logic in
 * `lib/library/reading.ts` and testable without a database. This file only
 * moves rows.
 *
 * Keyed on title rather than on the curriculum id, so a book you add yourself
 * and a book the curriculum knows about behave the same way, and picking one
 * back up updates its row instead of starting a second history of it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadingEntry, ReadingStatus, Verdict } from "./library/reading";

/**
 * The reading table has not been created yet.
 *
 * Mirrors the hands store: the one database failure with a specific, actionable
 * fix deserves to say so rather than surfacing as a stack trace.
 */
export class MissingReadingTableError extends Error {
  constructor() {
    super('The "reading_log" table does not exist yet.');
    this.name = "MissingReadingTableError";
  }
}

function missingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table/i.test(error.message ?? "")
  );
}

interface Row {
  book_id: string | null;
  title: string;
  author: string | null;
  status: ReadingStatus;
  verdict: Verdict | null;
  note: string | null;
  started_at: string;
  finished_at: string | null;
}

const COLUMNS =
  "book_id, title, author, status, verdict, note, started_at, finished_at";

/** Everything you have read, most recently touched first. */
export async function loadReading(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReadingEntry[]> {
  const { data, error } = await supabase
    .from("reading_log")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (missingTable(error)) throw new MissingReadingTableError();
    throw new Error(`Could not load your reading: ${error.message}`);
  }

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    bookId: row.book_id,
    title: row.title,
    author: row.author,
    status: row.status,
    verdict: row.verdict,
    note: row.note,
    startedAt: new Date(row.started_at),
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
  }));
}

export interface SaveReading {
  bookId?: string | null;
  title: string;
  author?: string | null;
  status: ReadingStatus;
  verdict?: Verdict | null;
  note?: string | null;
}

/**
 * Start, finish or put down a book.
 *
 * An upsert rather than an insert, because one book moves through several
 * states and each is an edit to a single record rather than a new event.
 * `finished_at` is set only on the transitions that actually close a book, so
 * editing a note later cannot quietly rewrite when you finished it.
 */
export async function saveReading(
  supabase: SupabaseClient,
  userId: string,
  entry: SaveReading,
): Promise<void> {
  const closing = entry.status === "finished" || entry.status === "abandoned";

  const { error } = await supabase.from("reading_log").upsert(
    {
      user_id: userId,
      book_id: entry.bookId ?? null,
      title: entry.title,
      author: entry.author ?? null,
      status: entry.status,
      verdict: entry.verdict ?? null,
      note: entry.note ?? null,
      finished_at: closing ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,title" },
  );

  if (error) {
    if (missingTable(error)) throw new MissingReadingTableError();
    throw new Error(`Could not save that: ${error.message}`);
  }
}
