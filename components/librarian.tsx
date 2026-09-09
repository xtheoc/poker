"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The conversation with the librarian, such as it is.
 *
 * Two moves and no more: say you have finished the book you were on, and pick
 * the next from a shortlist. Everything clever happens between those two
 * clicks, in `lib/library/reading.ts`, and it only works because the first one
 * asks *how it went* rather than merely recording that it is done.
 *
 * **The shortlist is now behind the button rather than beside it.** It used to
 * sit open on the page permanently, which turned a library into a sales pitch:
 * three books you are not reading, argued for at length, above the one you
 * are. A recommendation is only useful at the moment you need one, and that
 * moment is exactly when you finish something — so that is when it appears.
 *
 * The verdict buttons are the whole design. "Finished" alone can do nothing but
 * advance a list. "Finished, and it was over my head" can offer something
 * gentler; "knew most of it" can skip a stage. The note beside them is free
 * text and optional, and it is for you rather than for the algorithm: what you
 * made of a book is worth having when you come back to it in a year.
 */

export interface BookCard {
  bookId: string;
  title: string;
  author: string;
  year: number;
  /** Why this one, now, given what you have read. */
  because: string;
  aged?: string;
  activeHours: [number, number];
  free?: boolean;
  url?: string;
}

export interface CurrentBook {
  bookId: string | null;
  title: string;
  author?: string | null;
}

type Verdict = "right" | "too-basic" | "too-hard" | "bounced";

const VERDICTS: Array<{ id: Verdict; label: string; hint: string }> = [
  { id: "right", label: "Pitched right", hint: "Carry on through the stages" },
  {
    id: "too-basic",
    label: "Knew most of it",
    hint: "Skip ahead to something denser",
  },
  {
    id: "too-hard",
    label: "Over my head",
    hint: "Offer something gentler next",
  },
];

type Phase = "idle" | "rating" | "options";

export function Librarian({
  current,
  options,
  signedIn,
}: {
  current: CurrentBook | null;
  options: BookCard[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (body: Record<string, unknown>, next: Phase) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/books", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error ?? "Could not save that.");
        }
        setPhase(next);
        setVerdict(null);
        setNote("");
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not save that.",
        );
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const close = useCallback(
    (status: "finished" | "abandoned", chosen: Verdict) => {
      if (!current) return;
      void send(
        {
          bookId: current.bookId,
          title: current.title,
          author: current.author,
          status,
          verdict: chosen,
          note: note.trim() || null,
        },
        // Straight on to the shortlist: finishing a book is the one moment a
        // recommendation is actually wanted.
        "options",
      );
    },
    [current, note, send],
  );

  if (!signedIn) return null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      )}

      {phase === "idle" && (
        <button
          onClick={() => setPhase(current ? "rating" : "options")}
          className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          {current ? `Finished ${current.title}?` : "What should I read next?"}
        </button>
      )}

      {phase === "rating" && current && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-medium">{current.title}</p>
          <p className="mt-3 mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            How did it land? This decides what comes next.
          </p>

          <div className="flex flex-wrap gap-2">
            {VERDICTS.map((option) => (
              <button
                key={option.id}
                title={option.hint}
                onClick={() => setVerdict(option.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                  verdict === option.id
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What was good, what wasn't. Optional."
            className="mt-3 w-full resize-none rounded-lg border border-zinc-200 bg-transparent p-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              disabled={busy || !verdict}
              onClick={() => verdict && close("finished", verdict)}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
            >
              {busy ? "Saving…" : "Done"}
            </button>
            <button
              disabled={busy}
              onClick={() => close("abandoned", "bounced")}
              className="text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-40 dark:hover:text-zinc-300"
            >
              I put it down
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "options" && (
        <div className="space-y-2">
          {options.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              That is the whole curriculum. Books stop being the constraint here
              — a solver is the next step.
            </p>
          ) : (
            options.map((book) => (
              <Option
                key={book.bookId}
                book={book}
                busy={busy}
                onStart={() =>
                  send(
                    {
                      bookId: book.bookId,
                      title: book.title,
                      author: book.author,
                      status: "reading",
                    },
                    "idle",
                  )
                }
              />
            ))
          )}
          <button
            onClick={() => setPhase("idle")}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}

function Option({
  book,
  busy,
  onStart,
}: {
  book: BookCard;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium">{book.title}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {book.author}, {book.year}
        </span>
        {book.free && (
          <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">
            Free
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          {book.activeHours[0]}–{book.activeHours[1]}h
        </span>
      </div>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {book.because}
      </p>

      {/* The honest verdict is the point of the curriculum file: a reading list
          that hides what has aged sends you off to memorise a strategy that is
          simply wrong. Kept even in a pass whose brief was less text. */}
      {book.aged && (
        <p className="mt-2 rounded border-l-2 border-amber-400 bg-amber-50 py-1 pl-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          {book.aged}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={onStart}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Start this one
        </button>
        {book.url && (
          <a
            href={book.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-600 underline dark:text-sky-400"
          >
            Where to get it
          </a>
        )}
      </div>
    </div>
  );
}
