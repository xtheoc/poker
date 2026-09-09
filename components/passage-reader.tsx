"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageFigures } from "@/components/page-figures";
import type { Enrichment } from "@/lib/reader/ai";
import { readBlocks } from "@/lib/reader/typeset";

/**
 * Reading one portion, and the loop at the end of it.
 *
 * This replaced a PDF viewer. Rendering the real pages preserved the diagrams
 * and made everything else worse: a fixed column width, the publisher's type
 * size, a bright page in a dark room, and no way to set a comfortable measure.
 * The text is the part being studied, so the text is what gets typeset.
 *
 * The reading column is deliberately narrow. Somewhere around 60-70 characters
 * a line is where the eye finds the start of the next line without effort; a
 * full-width paragraph is the commonest reason long-form reading feels tiring
 * on a screen.
 *
 * Then the loop:
 *
 * 1. **Read.** Text, with notes above it if the model had anything to add.
 * 2. **Everything hides.** Not scrolled past — gone. Leaving it up would make
 *    the summary a transcription exercise.
 * 3. **Write what it said.**
 * 4. **It names what you left out**, and you write again. The portion does not
 *    close until nothing is missing.
 */

type Phase = "reading" | "writing" | "done";

export interface PassageView {
  id: string;
  index: number;
  firstPage: number;
  lastPage: number;
  sectionTitle: string | null;
  text: string;
  enrichment: Enrichment | null;
  recallText: string | null;
  completeAt: string | null;
  attempts: number;
  missing: string[] | null;
  figurePages: number[] | null;
}

/**
 * Attempts before the reader is offered a way past the gate.
 *
 * Not a concession to giving up — an escape from the tool being wrong. A
 * mangled extraction, or a section with nothing in it to recall, would
 * otherwise be a dead end, and a dead end ends the book.
 */
const ATTEMPTS_BEFORE_ESCAPE = 3;

export function PassageReader({
  bookId,
  passage,
  total,
  pdfUrl,
}: {
  bookId: string;
  passage: PassageView;
  total: number;
  /** Signed URL for the original PDF, used only to render figure pages. */
  pdfUrl: string | null;
}) {
  const router = useRouter();

  const complete = passage.completeAt !== null;
  const [phase, setPhase] = useState<Phase>(complete ? "done" : "reading");
  const [summary, setSummary] = useState(passage.recallText ?? "");
  const [missing, setMissing] = useState<string[]>(passage.missing ?? []);
  const [attempts, setAttempts] = useState(passage.attempts);
  const [rules, setRules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Enrichment | null>(passage.enrichment);

  /**
   * Keep the draft where a refresh cannot take it.
   *
   * Writing five minutes of recall and losing it to a stray reload, a crash or
   * a mis-hit shortcut is the worst thing this app could do to someone: it
   * punishes exactly the effort the whole design exists to encourage, and
   * nobody writes as carefully the second time.
   *
   * Local storage rather than the server, because a draft is per-device scratch
   * and saving every keystroke to Postgres would be absurd.
   */
  const draftKey = `reader-draft:${passage.id}`;

  /**
   * Restore on the way into writing, not on mount.
   *
   * A mount effect would be the obvious place and is the wrong one twice over:
   * it sets state during an effect, and it reads `localStorage` during
   * hydration, when the server has already rendered an empty box. Doing it in
   * the click handler avoids both — an event is exactly where a state change
   * belongs — and it restores at the only moment the draft is wanted.
   */
  const startWriting = useCallback(() => {
    setPhase("writing");
    try {
      const saved = localStorage.getItem(draftKey);
      // Only when nothing has been typed yet, so it can never overwrite work
      // in progress.
      if (saved) setSummary((current) => current || saved);
    } catch {
      // Private browsing, or storage disabled. Not worth mentioning.
    }
  }, [draftKey]);

  useEffect(() => {
    if (complete) return;
    try {
      if (summary.trim()) localStorage.setItem(draftKey, summary);
    } catch {
      // As above.
    }
  }, [complete, draftKey, summary]);

  // Fetch the notes once. Cached server-side, so revisiting costs nothing.
  useEffect(() => {
    if (notes) return;
    let cancelled = false;

    fetch("/api/reader/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, passageId: passage.id }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        // A missing key, or a passage the model could not read. Neither is
        // worth an error: the text reads perfectly well without notes.
        if (!cancelled && response.ok && body?.enrichment) {
          setNotes(body.enrichment as Enrichment);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [bookId, notes, passage.id]);

  const submit = useCallback(
    async (force = false) => {
      if (!summary.trim()) return;
      setSaving(true);
      setError(null);

      try {
        const response = await fetch("/api/reader/recall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passageId: passage.id,
            bookId,
            text: summary,
            force,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error ?? "Could not save that.");
        }

        setAttempts(result?.attempts ?? attempts + 1);
        setMissing(result?.missing ?? []);

        if (result?.complete) {
          setRules(result?.rules ?? []);
          setPhase("done");
          // The summary is on the server now; the scratch copy has done its job.
          try {
            localStorage.removeItem(draftKey);
          } catch {
            // Storage unavailable. The draft simply expires with the browser.
          }
          router.refresh();
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not save that.",
        );
      } finally {
        setSaving(false);
      }
    },
    [attempts, bookId, draftKey, passage.id, router, summary],
  );

  /*
   * Drop a leading heading that just repeats the section title.
   *
   * The title already stands above the text as the article's heading, and the
   * first line of the first page is very often that same title — so it arrived
   * twice, one under the other, which looks like a bug because it is one.
   */
  const all = readBlocks(passage.text);
  const blocks =
    all[0]?.type === "heading" &&
    passage.sectionTitle &&
    all[0].text.trim().toLowerCase() ===
      passage.sectionTitle.trim().toLowerCase()
      ? all.slice(1)
      : all;

  const figurePages = passage.figurePages ?? [];
  const pages =
    passage.firstPage === passage.lastPage
      ? `p${passage.firstPage}`
      : `p${passage.firstPage}–${passage.lastPage}`;

  return (
    <div>
      {/*
       * An article header rather than a status bar.
       *
       * The same three facts as before — where you are, what this section is,
       * which pages — arranged the way a piece of writing announces itself: a
       * small line of context, the title, then a rule. Set as a row of metadata
       * they read as chrome, and the text underneath began with no introduction
       * at all, which is a large part of why it arrived as a slab.
       */}
      <header className="mx-auto mb-10 max-w-[52rem] border-b border-zinc-800 pb-6">
        <p className="text-xs tracking-wide text-zinc-600 uppercase">
          {passage.index + 1} of {total} · {pages}
        </p>
        {passage.sectionTitle && (
          <h1 className="mt-2 font-serif text-3xl leading-tight text-zinc-100">
            {passage.sectionTitle}
          </h1>
        )}
      </header>

      {error && (
        <p className="mb-6 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {phase !== "writing" && (
        /*
         * Wider, and larger with it.
         *
         * Filling more of the screen was the ask; simply stretching the column
         * would have made reading worse, because what tires the eye is
         * characters per line rather than inches. Growing the type as the
         * measure grows holds that count roughly where it was while the text
         * occupies far more of the window — the page gets bigger instead of the
         * lines getting longer.
         */
        /*
         * Serif, and larger.
         *
         * The single biggest lever on whether text reads as an article or as
         * application UI. A sans-serif paragraph at 19px in a dark box looks
         * like a dialog no matter how the spacing is tuned; the same words in a
         * serif at 20px with open leading read as something written to be read.
         * It is also what the book itself is set in.
         */
        <article className="mx-auto max-w-[52rem] font-serif">
          {blocks.map((block, i) =>
            block.type === "heading" ? (
              <h2
                key={i}
                className="mt-14 mb-5 text-2xl leading-snug text-zinc-100 first:mt-0"
              >
                {block.text}
              </h2>
            ) : (
              <p
                key={i}
                className="mb-7 text-[1.25rem] leading-[1.8] text-zinc-300"
              >
                {block.text}
              </p>
            ),
          )}
        </article>
      )}

      {phase !== "writing" && pdfUrl && figurePages.length > 0 && (
        <PageFigures pdfUrl={pdfUrl} pages={figurePages} />
      )}

      {phase === "reading" && (
        <button
          onClick={startWriting}
          className="mx-auto mt-12 block w-full max-w-[52rem] rounded-xl border border-zinc-700 py-3 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Done reading
        </button>
      )}

      {phase === "writing" && (
        <div className="mx-auto max-w-[52rem]">
          <p className="mb-1 text-sm font-medium text-zinc-100">
            What did this section say?
          </p>
          <p className="mb-4 text-xs text-zinc-500">
            In your own words, from memory.
          </p>

          {missing.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-800 bg-amber-950/30 p-4">
              <p className="mb-2 text-xs font-medium text-amber-300">
                Still missing
              </p>
              <ul className="space-y-1">
                {missing.map((item) => (
                  <li
                    key={item}
                    className="text-sm leading-relaxed text-amber-100"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <textarea
            autoFocus
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            // The convention for "send" in any box you might also press Enter
            // inside. Plain Enter has to stay a newline — this is prose.
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            rows={14}
            className="w-full rounded-xl border border-zinc-700 bg-transparent p-4 font-serif text-[1.0625rem] leading-relaxed text-zinc-100"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => submit()}
              disabled={saving || !summary.trim()}
              className="rounded-xl bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-40"
            >
              {saving
                ? "Checking…"
                : missing.length > 0
                  ? "Check again"
                  : "Check"}
            </button>
            <button
              onClick={() => setPhase("reading")}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Back to the text
            </button>
            {attempts >= ATTEMPTS_BEFORE_ESCAPE && (
              <button
                onClick={() => submit(true)}
                disabled={saving}
                className="ml-auto text-xs text-zinc-600 hover:text-zinc-400"
                title="Use this if the review is wrong about the passage"
              >
                Move on anyway
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mx-auto mt-10 max-w-[52rem] space-y-4">
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
            <p className="text-sm font-medium text-emerald-200">
              Section complete.
            </p>
            {rules.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {rules.map((rule) => (
                  <li
                    key={rule}
                    className="text-sm leading-relaxed text-emerald-100"
                  >
                    {rule}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* The notes belong here, not before the text. Read first, then see
              what the section was arguing — beforehand they are a summary you
              read instead of the book. */}
          {notes && <Notes notes={notes} />}

          {summary && (
            <details>
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                What you wrote
              </summary>
              <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-400">
                {summary}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The model's pass over this portion, shown after you have written yours.
 *
 * It used to sit above the text, which was exactly wrong: a tidy summary of the
 * argument, offered before the argument, is a thing you read *instead of* the
 * book. Placed after your own summary it does the opposite job — you can see
 * what the section was making of it, having already committed to what you made
 * of it.
 */
function Notes({ notes }: { notes: Enrichment }) {
  const empty =
    notes.claims.length === 0 && !notes.example && notes.atTable.length === 0;
  if (empty) return null;

  return (
    <div className="rounded-xl border border-zinc-800 p-4">
      {notes.claims.length > 0 && (
        <ul className="space-y-1.5">
          {notes.claims.map((claim) => (
            <li key={claim} className="text-sm leading-relaxed text-zinc-300">
              {claim}
            </li>
          ))}
        </ul>
      )}

      {notes.example && (
        <p className="mt-3 border-l-2 border-sky-700 pl-3 text-sm leading-relaxed text-zinc-400">
          {notes.example}
        </p>
      )}

      {notes.atTable.length > 0 && (
        <ul className="mt-3 space-y-1">
          {notes.atTable.map((line) => (
            <li key={line} className="text-sm font-medium text-zinc-200">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
