import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MigrationNotice } from "@/components/migration-notice";
import { PassageReader } from "@/components/passage-reader";
import {
  type Book,
  MissingReaderTableError,
  type Passage,
  loadBook,
  loadPassages,
  pagesReadOn,
  signedBookUrl,
  unlockedIndex,
} from "@/lib/reader/store";
import { localDate, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reading" };

/**
 * Reading one portion of a book.
 *
 * Dark regardless of the app's theme. This is the one screen someone stares at
 * for twenty unbroken minutes, usually at night, and a bright page is the
 * reason that stops being comfortable.
 *
 * Two rules are enforced here rather than in the component, because a rule that
 * only exists in the browser is not a rule:
 *
 * **The gate.** `?p=` is a URL anyone can edit, so a request for a portion past
 * the furthest completed one is redirected rather than rendered.
 *
 * **The daily limit.** Past it, the next unread portion does not open until
 * tomorrow. Going *back* over finished portions stays allowed — rereading is
 * not the behaviour the limit exists to stop.
 */
export default async function ReadingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { id } = await params;
  const { p } = await searchParams;
  const session = await requireUser();

  // A migration that has not been run is not a bug, and answering it with a
  // stack trace sends you looking for one. Anything else still throws — a real
  // failure should stay loud rather than hiding behind a friendly message.
  let book: Book | null;
  let passages: Passage[];
  try {
    book = await loadBook(session.supabase, session.userId, id);
    passages = book
      ? await loadPassages(session.supabase, session.userId, id)
      : [];
  } catch (error) {
    if (!(error instanceof MissingReaderTableError)) throw error;
    return (
      <Shell bookTitle="Reading" id={id}>
        <MigrationNotice file={error.migration} />
      </Shell>
    );
  }

  if (!book) notFound();

  if (passages.length === 0) {
    return (
      <Shell bookTitle={book.title} id={id}>
        <p className="text-sm text-zinc-400">
          {book.status === "processing"
            ? "Still splitting this one into sections."
            : (book.error ?? "Nothing readable in this book.")}
        </p>
      </Shell>
    );
  }

  const unlocked = unlockedIndex(passages);
  const requested = p ? Number.parseInt(p, 10) : unlocked;
  const index = Number.isFinite(requested) ? requested : unlocked;

  if (index > unlocked || index < 0 || index >= passages.length) {
    redirect(`/reader/${id}?p=${unlocked}`);
  }

  const passage = passages[index];

  const timezone = session.profile?.timezone ?? "UTC";
  const goal = session.profile?.daily_pages ?? 12;
  const readToday = pagesReadOn(passages, localDate(timezone), timezone);
  // The limit only ever blocks new ground. A finished portion stays open.
  const blocked = passage.completeAt === null && readToday >= goal;

  const previous = index > 0 ? index - 1 : null;
  const next =
    index + 1 < passages.length && passage.completeAt !== null
      ? index + 1
      : null;

  const done = passages.filter((p) => p.completeAt !== null).length;

  // Only minted when this portion actually has a figure to show. A signed URL
  // is cheap, but handing one out on every page view of a book that is pure
  // text is a credential issued for nothing.
  const pdfUrl =
    (passage.figurePages?.length ?? 0) > 0
      ? await signedBookUrl(session.supabase, book.storagePath)
      : null;

  return (
    <Shell
      bookTitle={book.title}
      id={id}
      progress={{ done, total: passages.length }}
      today={{ read: readToday, goal }}
      contents={passages.map((p) => ({
        index: p.index,
        title: p.sectionTitle,
        firstPage: p.firstPage,
        lastPage: p.lastPage,
        done: p.completeAt !== null,
        open: p.index <= unlocked,
      }))}
    >
      {blocked ? (
        <div className="mx-auto max-w-[52rem] rounded-xl border border-zinc-800 p-6 text-center">
          <p className="text-sm font-medium text-zinc-100">
            Daily goal reached.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {readToday} of {goal} pages today. The next section opens tomorrow.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Reading further tonight would feel like progress and would not be —
            the same hours spread over more days is what makes any of it stick.
          </p>
          <Link
            href={`/reader/${id}/summary`}
            className="mt-5 inline-block rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-300"
          >
            Read what you have learned so far
          </Link>
        </div>
      ) : (
        <>
          <PassageReader
            // Keyed by passage so moving on resets the phase rather than
            // leaving the previous section's summary on screen.
            key={passage.id}
            bookId={book.id}
            total={passages.length}
            pdfUrl={pdfUrl}
            passage={{
              id: passage.id,
              index: passage.index,
              firstPage: passage.firstPage,
              lastPage: passage.lastPage,
              sectionTitle: passage.sectionTitle,
              text: passage.text,
              enrichment: passage.enrichment,
              recallText: passage.recallText,
              completeAt: passage.completeAt?.toISOString() ?? null,
              attempts: passage.attempts,
              missing: passage.missing,
              figurePages: passage.figurePages,
            }}
          />

          {/* The daily count moved up into the header: between the arrows it
              sat where you look to move on, which made a limit feel like a
              scold at exactly the wrong moment. */}
          <div className="mx-auto mt-10 flex max-w-[52rem] items-center justify-between">
            <NavLink
              href={previous === null ? null : `/reader/${id}?p=${previous}`}
            >
              ← Back
            </NavLink>
            <NavLink href={next === null ? null : `/reader/${id}?p=${next}`}>
              Next →
            </NavLink>
          </div>
        </>
      )}
    </Shell>
  );
}

/**
 * The dark reading shell.
 *
 * `dark` is forced on the wrapper rather than following the app theme: this
 * screen is for long stretches of reading, and the request was explicit.
 */
interface ContentsEntry {
  index: number;
  title: string | null;
  firstPage: number;
  lastPage: number;
  done: boolean;
  open: boolean;
}

function Shell({
  children,
  bookTitle,
  id,
  progress,
  today,
  contents,
}: {
  children: React.ReactNode;
  bookTitle: string;
  id: string;
  progress?: { done: number; total: number };
  today?: { read: number; goal: number };
  contents?: ContentsEntry[];
}) {
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="dark min-h-screen bg-zinc-950">
      {/*
       * A thin band of progress across the top of the window.
       *
       * The one thing a reader wants to know without asking, and the thing this
       * had no way of showing: how much of the book is behind you. Full-bleed
       * and one pixel of colour, so it answers the question without becoming
       * something to look at.
       */}
      {progress && (
        <div className="h-0.5 w-full bg-zinc-900">
          <div
            className="h-full bg-zinc-500 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Wide enough for the reading measure inside it, with room either side.
          The column does the centring; this only sets the bounds. */}
      <main className="mx-auto w-full max-w-[56rem] px-6 py-8">
        {/*
         * The title leads and the navigation recedes.
         *
         * Three items spread edge to edge read as three equal choices, which is
         * why "Shelf" ended up competing with the book you are actually
         * reading. Here the title is the heading and the links are a quiet pair
         * beside it.
         */}
        <div className="mb-10 flex items-baseline gap-4">
          <h1 className="truncate text-sm text-zinc-300">{bookTitle}</h1>
          {today && (
            <span className="shrink-0 text-xs text-zinc-600">
              {today.read}/{today.goal} today
            </span>
          )}
          <div className="ml-auto flex shrink-0 gap-4 text-xs text-zinc-600">
            <Link href={`/reader/${id}/summary`} className="hover:text-zinc-300">
              Summary
            </Link>
            <Link href="/library" className="hover:text-zinc-300">
              Library
            </Link>
          </div>
        </div>

        {children}

        {contents && contents.length > 0 && (
          <Contents id={id} entries={contents} />
        )}
      </main>
    </div>
  );
}

/**
 * Where you are in the book, and a way back to anything finished.
 *
 * Collapsed by default and placed at the foot of the page: while reading, a
 * visible list of everything you have not read yet is a distraction from the
 * few pages in front of you. It is here for the moment you want to check what
 * a previous section said, which is a different moment entirely.
 *
 * Locked sections render as plain text rather than dead links — a link that
 * refuses to work is worse than one that is visibly not there.
 */
function Contents({ id, entries }: { id: string; entries: ContentsEntry[] }) {
  return (
    <details className="mt-16 border-t border-zinc-900 pt-6">
      <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
        Contents
      </summary>
      <ol className="mt-4 space-y-0.5">
        {entries.map((entry) => {
          const label = (
            <>
              <span className="w-8 shrink-0 text-right text-xs text-zinc-700 tabular-nums">
                {entry.index + 1}
              </span>
              <span className="truncate">{entry.title ?? "—"}</span>
              <span className="ml-auto shrink-0 text-xs text-zinc-700 tabular-nums">
                p{entry.firstPage}
              </span>
            </>
          );

          return (
            <li key={entry.index}>
              {entry.open ? (
                <Link
                  href={`/reader/${id}?p=${entry.index}`}
                  className={cn(
                    "-mx-2 flex items-baseline gap-3 rounded px-2 py-1.5 text-sm hover:bg-zinc-900",
                    entry.done ? "text-zinc-500" : "text-zinc-200",
                  )}
                >
                  {label}
                </Link>
              ) : (
                <div className="-mx-2 flex items-baseline gap-3 px-2 py-1.5 text-sm text-zinc-800">
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  const className = cn(
    "rounded-lg px-3 py-1.5 text-sm",
    href ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700",
  );

  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}
