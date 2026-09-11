"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

/** One deliberate action to backfill strategy review for existing imports. */
export function StrategyHandReview({ strategyId }: { strategyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const review = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/strategies/${strategyId}/hands/review`, {
        method: "POST",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Could not review your hands.");
      setMessage(
        `${result.hands} hands reviewed · ${result.charted} preflop decisions checked · ${result.mistakes} mistakes`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not review your hands.");
    } finally {
      setBusy(false);
    }
  }, [router, strategyId]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        onClick={review}
        disabled={busy}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
      >
        {busy ? "Reviewing..." : "Review imported hands"}
      </button>
      {message && <p className="text-xs text-zinc-500 dark:text-zinc-400">{message}</p>}
    </div>
  );
}
