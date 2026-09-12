"use client";

import { FolderSync } from "lucide-react";

export function HandHistoryWatcher() {
  return (
    <div className="border-y border-zinc-200 py-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderSync className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium">Automatic import</p>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">after PokerStars closes</span>
      </div>

      <details className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100">Set up on this PC</summary>
        <p className="mt-2 leading-relaxed">
          Double-click <code className="font-mono">watcher\\setup-watcher.cmd</code> in this project. It starts automatically when you sign in to Windows.
        </p>
      </details>
    </div>
  );
}
