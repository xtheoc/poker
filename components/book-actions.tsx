"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Renaming and removing a book, from the shelf.
 *
 * Two decisions worth stating.
 *
 * **The controls stay out of the way until asked for.** A shelf is for opening
 * books; rename and delete are rare. Putting them permanently on every row
 * means the destructive one is always a mis-click away from a title you meant
 * to open.
 *
 * **Delete asks, and names what goes with it.** The PDF is the least of it —
 * every summary you wrote for that book and every rule it contributed go too,
 * because none of them mean anything without the text. "Are you sure?" would be
 * a worse prompt than saying what is lost.
 */
export function BookActions({
  bookId,
  title,
}: {
  bookId: string;
  title: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "menu" | "rename" | "confirm">(
    "idle",
  );
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/reader/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId, ...body }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error ?? "Could not do that.");
        }
        setMode("idle");
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not do that.",
        );
      } finally {
        setBusy(false);
      }
    },
    [bookId, router],
  );

  if (mode === "rename") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              void send({ action: "rename", title: name.trim() });
            }
            if (e.key === "Escape") setMode("idle");
          }}
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
        <button
          onClick={() => send({ action: "rename", title: name.trim() })}
          disabled={busy || !name.trim()}
          className="text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:hover:text-zinc-100"
        >
          Save
        </button>
        <button
          onClick={() => setMode("idle")}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "confirm") {
    return (
      <div className="mt-2 rounded-lg border border-rose-300 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
        <p className="text-xs leading-relaxed text-rose-900 dark:text-rose-200">
          Delete <span className="font-medium">{title}</span>? The summaries you
          wrote and the rules it added go with it.
        </p>
        <div className="mt-2 flex gap-3">
          <button
            onClick={() => send({ action: "delete" })}
            disabled={busy}
            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setMode("idle")}
            className="text-xs text-rose-800 hover:underline dark:text-rose-300"
          >
            Keep it
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (mode === "menu") {
    return (
      <div className="mt-1 flex gap-3">
        <button
          onClick={() => {
            setName(title);
            setMode("rename");
          }}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Rename
        </button>
        <button
          onClick={() => setMode("confirm")}
          className="text-xs text-rose-600 hover:underline dark:text-rose-400"
        >
          Delete
        </button>
        <button
          onClick={() => setMode("idle")}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setMode("menu")}
      aria-label={`Options for ${title}`}
      className="mt-1 text-xs text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300"
    >
      Edit
    </button>
  );
}
