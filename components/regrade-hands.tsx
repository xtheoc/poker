"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Re-judge every hand you have imported.
 *
 * Behind a confirmation, and the confirmation names what moves rather than
 * asking whether you are sure. Re-grading is not destructive the way deleting
 * is — the hands survive, and the raw text they are replayed from is never
 * touched — but it rewrites every verdict the app has recorded about you, and
 * your accuracy will be a different number afterwards. That earns one
 * deliberate click.
 *
 * Slow by nature: it re-parses the stored text of every hand you own. The
 * button says so rather than appearing to hang.
 */
export function RegradeHands({ chartName }: { chartName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/hands/regrade", { method: "POST" });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "Could not re-grade your hands.");
      }

      setDone(
        `${result.hands} hands re-graded · ${result.charted} decisions the chart covers · ${result.mistakes} mistakes`,
      );
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not re-grade your hands.",
      );
    } finally {
      setBusy(false);
    }
  }, [router]);

  return (
    <div>
      <h2 className="text-sm font-semibold">Re-grade your hands</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Your hands were graded by whichever chart was current when you imported
        them. Replay them against {chartName}.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Re-grade
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Every verdict is recomputed, so your accuracy and leaks will change.
            The hands themselves are untouched.
          </span>
          <button
            onClick={run}
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {busy ? "Re-grading…" : "Do it"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      )}

      {done && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          {done}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
