"use client";

import { useEffect } from "react";

/** Keeps one bad historical hand from taking the whole strategy workspace down. */
export default function SessionError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Retain the detail in Vercel logs without exposing internal database text.
    console.error("Could not render strategy session");
  }, []);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm font-medium">Could not open this session.</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Your hands are still stored. Try again once; if it persists, return to the session list.
      </p>
      <button
        onClick={reset}
        className="mt-5 w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
