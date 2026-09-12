"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Importing a session.
 *
 * The previous version parsed in the browser and forgot everything on reload,
 * which quietly disabled the leak engine: a leak is a pattern *across* sessions,
 * and a tool that cannot remember last week can only ever see one sitting. So
 * the file now goes to the server, is parsed and graded there, and is stored
 * under your account.
 *
 * That is a real change in where your hands live, so the copy below says so
 * plainly rather than repeating the old reassurance that they never leave the
 * machine — which stopped being true the moment this started working.
 */

/**
 * Characters per request.
 *
 * A hand is roughly 1.5 KB, so this is around a thousand hands per round trip.
 * Files are split on hand boundaries rather than sent whole, because a year's
 * archive dragged in at once is one request that either times out or is
 * rejected, and either way loses the entire import.
 */
const CHUNK_CHARS = 1_500_000;

interface ImportResult {
  parsed: number;
  stored: number;
  duplicates: number;
  charted: number;
  mistakes: number;
  latestHandId: string | null;
  unparsed: number;
}

/**
 * Split a history file on hand boundaries.
 *
 * Splitting anywhere else tears a hand in half and loses both pieces, so the
 * boundary is the header line rather than a character count.
 */
export function chunkHistory(text: string, maxChars = CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const hands = text.split(
    /(?=^PokerStars\s+(?:Zoom\s+|Home\s+)?(?:Hand|Game)\s+#)/m,
  );
  const chunks: string[] = [];
  let current = "";

  for (const hand of hands) {
    if (current && current.length + hand.length > maxChars) {
      chunks.push(current);
      current = "";
    }
    current += hand;
  }
  if (current.trim()) chunks.push(current);

  return chunks;
}

export function HandImport({
  signedIn,
  sessionHref = (id) => `/hands/session/${id}`,
}: {
  signedIn: boolean;
  /** Lets a strategy workspace return to its own session review. */
  sessionHref?: (id: string) => string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      setBusy(true);
      setError(null);
      setResult(null);

      const total: ImportResult = {
        parsed: 0,
        stored: 0,
        duplicates: 0,
        charted: 0,
        mistakes: 0,
        latestHandId: null,
        unparsed: 0,
      };

      try {
        for (const chunk of chunkHistory(text)) {
          const response = await fetch("/api/hands/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk }),
          });

          const body = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(body?.error ?? "Could not import those hands.");
          }

          total.parsed += body.parsed ?? 0;
          total.stored += body.stored ?? 0;
          total.duplicates += body.duplicates ?? 0;
          total.charted += body.charted ?? 0;
          total.mistakes += body.mistakes ?? 0;
          total.unparsed += body.unparsed ?? 0;
          total.latestHandId = body.latestHandId ?? total.latestHandId;
        }

        setResult(total);
        // The session list is server-rendered; without this it would keep
        // showing the state from before the import.
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not import those hands.",
        );
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const contents = await Promise.all([...files].map((f) => f.text()));
      await send(contents.join("\n\n"));
    },
    [send],
  );

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          Sign in to import your hands.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block">
          <span className="text-sm font-medium">
            Import a session
            {busy && (
              <span className="ml-2 text-xs font-normal text-zinc-500">
                reading…
              </span>
            )}
          </span>
          <input
            type="file"
            accept=".txt"
            multiple
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
            className="mt-2 block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-50 dark:text-zinc-400 dark:file:border-zinc-700"
          />
        </label>

      </div>

      {error && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      )}

      {result && <Summary result={result} sessionHref={sessionHref} />}
    </div>
  );
}

function Summary({
  result,
  sessionHref,
}: {
  result: ImportResult;
  sessionHref: (id: string) => string;
}) {
  const fresh = result.stored - result.duplicates;

  if (result.parsed === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        No hands found in that file.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <p className="font-medium text-emerald-900 dark:text-emerald-200">
        {fresh > 0
          ? `${fresh} new ${fresh === 1 ? "hand" : "hands"} imported.`
          : "Nothing new — these hands were already here."}
      </p>
      <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
        {result.charted} preflop {result.charted === 1 ? "spot" : "spots"} the
        chart covers, {result.mistakes}{" "}
        {result.mistakes === 1 ? "mistake" : "mistakes"} found.
        {result.duplicates > 0 && ` ${result.duplicates} already imported.`}
        {result.unparsed > 0 &&
          ` ${result.unparsed} could not be read and were kept for later.`}
      </p>
      {result.latestHandId && (
        <Link
          href={sessionHref(result.latestHandId)}
          className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
        >
          See the session review
        </Link>
      )}
    </div>
  );
}
