"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Removing an import.
 *
 * Deleting hands is not tidying, it is a correction — the wrong file, somebody
 * else's history, a test fixture — and until this existed none of the numbers
 * could be fully trusted, because a mistake in what you imported was permanent
 * and counted against you forever.
 *
 * So the confirmation names the consequence rather than asking "are you sure":
 * the hands go, and their mistakes with them, which moves both your accuracy
 * and your leaks. That is the part worth knowing before clicking.
 */
export function SessionActions({
  handIds,
  label,
  onDeleted,
}: {
  handIds: string[];
  /** What is being removed, e.g. "Tue 5 Sep · 84 hands". */
  label: string;
  /** Where to go afterwards. Stays put by default. */
  onDeleted?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/hands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handIds }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "Could not remove those hands.");
      }

      if (onDeleted) router.push(onDeleted);
      else router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove those hands.",
      );
      setBusy(false);
    }
  }, [handIds, onDeleted, router]);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-zinc-400 hover:text-rose-600 dark:text-zinc-600 dark:hover:text-rose-400"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Delete {label}? Its mistakes go too, so your accuracy and leaks will
        change.
      </span>
      <button
        onClick={remove}
        disabled={busy}
        className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-40 dark:text-rose-400"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-xs text-zinc-400 hover:text-zinc-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}
