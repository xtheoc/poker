import Link from "next/link";
import { BookActions } from "@/components/book-actions";
import { BookUpload } from "@/components/book-upload";
import { type BookCard, Librarian } from "@/components/librarian";
import { MigrationNotice } from "@/components/migration-notice";
import {
  type ReadingEntry,
  type Verdict,
  nextOptions,
  reading,
} from "@/lib/library/reading";
import {
  type Book,
  type BookProgress,
  MissingReaderTableError,
  loadBooks,
  loadNoteCounts,
  loadProgress,
} from "@/lib/reader/store";
import { MissingReadingTableError, loadReading } from "@/lib/reading-store";
import { optionalUser } from "@/lib/session";

export const metadata = { title: "Library" };

const VERDICT_COPY: Record<Verdict, string> = {
  right: "pitched right",
  "too-basic": "knew most of it",
  "too-hard": "over my head",
  bounced: "put down",
};

/**
 * One page for books.
 *
 * Three things, in the order you want them: what you are in the middle of,
 * what you have built out of what you have read, and — behind a single button —
 * what to read next.
 *
 * This page had a text problem. It opened with a paragraph telling you your
 * hands showed nineteen leaks and that no book would fix them, then argued for
 * three books you were not reading, then listed the entire seven-stage
 * curriculum. All of it true, none of it what you came here for. The leak note
 * especially: unasked-for advice on every single visit, and a library is the
 * wrong place to be told to stop reading. (`readingIsTheAnswer` still exists
 * and is still tested; it has no caller until somewhere earns it.)
 *
 * What replaces it is a shelf of what you have actually made. Every book you
 * have read is a set of rules you wrote yourself, and those are the reason to
 * open this page at all — so the tiles lead to the summary, not to the reader.
 */
export default async function LibraryPage() {
  const session = await optionalUser();

  let history: ReadingEntry[] = [];
  let books: Book[] = [];
  let progress = new Map<string, BookProgress>();
  let rules = new Map<string, number>();
  let needsReadingTable = false;
  let readerMigration: string | null = null;

  if (session) {
    try {
      history = await loadReading(session.supabase, session.userId);
    } catch (error) {
      if (error instanceof MissingReadingTableError) needsReadingTable = true;
      else throw error;
    }

    try {
      [books, progress, rules] = await Promise.all([
        loadBooks(session.supabase, session.userId),
        loadProgress(session.supabase, session.userId),
        loadNoteCounts(session.supabase, session.userId),
      ]);
    } catch (error) {
      // The error names the migration, which may be a later one that only adds
      // a column rather than the migration that creates the tables.
      if (error instanceof MissingReaderTableError) {
        readerMigration = error.migration;
      } else throw error;
    }
  }

  /*
   * What the librarian thinks you are reading.
   *
   * The reading log wins when it has an open book. Failing that, a book you are
   * part-way through in the reader is plainly the answer — and that is the case
   * the old split got wrong, because the librarian could not see the reader at
   * all.
   */
  const logged = reading(history);
  const inProgress = books.find((book) => {
    const done = progress.get(book.id);
    return done && done.done > 0 && done.done < done.total;
  });
  const current =
    logged ??
    (inProgress
      ? {
          bookId: inProgress.curriculumId,
          title: inProgress.title,
          author: inProgress.author,
        }
      : null);

  const options: BookCard[] = nextOptions(history).map(({ book, because }) => ({
    bookId: book.id,
    title: book.title,
    author: book.author,
    year: book.year,
    because,
    aged: book.aged,
    activeHours: book.activeHours,
    free: book.free,
    url: book.url,
  }));

  const closed = history.filter((e) => e.status !== "reading");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
      </header>

      <div className="space-y-10">
        {needsReadingTable && (
          <MigrationNotice
            file="supabase/migrations/0004_reading.sql"
            what="The table that tracks what you are reading does not exist yet."
          />
        )}
        {readerMigration && (
          <MigrationNotice
            file={readerMigration}
            what="Your books are stored, but the reader needs something this migration adds."
          />
        )}

        {inProgress && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Reading now</h2>
            <ContinueCard
              book={inProgress}
              progress={progress.get(inProgress.id)}
            />
          </section>
        )}

        {/* The shelf. Every tile opens that book's summary rather than the book
            itself: the rules you wrote are what you come back for, and the
            reader is one click further on from there. */}
        {books.length > 0 && (
          <section>
            <div className="grid grid-cols-2 gap-3">
              {books.map((book) => (
                <BookTile
                  key={book.id}
                  book={book}
                  progress={progress.get(book.id)}
                  rules={rules.get(book.id) ?? 0}
                />
              ))}
            </div>
          </section>
        )}

        {!session ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Sign in to keep a shelf.
          </p>
        ) : (
          !readerMigration && <BookUpload userId={session.userId} />
        )}

        <Librarian
          current={current}
          options={options}
          signedIn={session !== null && !needsReadingTable}
        />

        {closed.length > 0 && (
          <section>
            <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              {closed.map((entry) => (
                <li
                  key={entry.title}
                  className="flex flex-wrap items-baseline gap-2 py-2"
                >
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {entry.title}
                  </span>
                  {entry.verdict && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {VERDICT_COPY[entry.verdict]}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
                    {(entry.finishedAt ?? entry.startedAt).toLocaleDateString(
                      undefined,
                      { month: "short", year: "numeric" },
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function ContinueCard({
  book,
  progress,
}: {
  book: Book;
  progress?: BookProgress;
}) {
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <Link
      href={`/reader/${book.id}`}
      className="block rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="flex items-baseline gap-3">
        <span className="truncate font-medium">{book.title}</span>
        <span className="ml-auto shrink-0 text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
          {progress ? `${progress.done} of ${progress.total}` : ""}
        </span>
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Continue reading →
      </p>
    </Link>
  );
}

/**
 * One book on the shelf.
 *
 * Shows the rule count rather than the page count, because that is the number
 * that says whether a book is worth reopening — one you read and wrote nothing
 * from has left you nothing to consult.
 */
function BookTile({
  book,
  progress,
  rules,
}: {
  book: Book;
  progress?: BookProgress;
  rules: number;
}) {
  if (book.status !== "ready") {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="line-clamp-2 text-sm text-zinc-400">{book.title}</p>
        <p className="mt-2 text-xs text-zinc-400">
          {book.status === "processing" ? "reading it…" : "failed"}
        </p>
        {book.error && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {book.error}
          </p>
        )}
        <BookActions bookId={book.id} title={book.title} />
      </div>
    );
  }

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
      <Link
        href={`/reader/${book.id}/summary`}
        className="flex flex-1 flex-col p-4"
      >
        <span className="line-clamp-2 text-sm font-medium">{book.title}</span>

        <span className="mt-auto pt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {rules > 0 ? (
            <>
              {rules} {rules === 1 ? "rule" : "rules"}
            </>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-600">
              no rules yet
            </span>
          )}
        </span>

        <span className="mt-2 block h-0.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
          <span
            className="block h-full rounded-full bg-zinc-500"
            style={{ width: `${percent}%` }}
          />
        </span>
      </Link>

      {/* Outside the link: a button nested in an anchor is invalid, and every
          click would also navigate. */}
      <div className="px-4 pb-3">
        <BookActions bookId={book.id} title={book.title} />
      </div>
    </div>
  );
}
