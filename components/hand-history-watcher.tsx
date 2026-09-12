"use client";

import { FolderSync } from "lucide-react";

export function HandHistoryWatcher() {
  return (
    <div className="border-y border-zinc-200 py-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FolderSync className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium">Automatic import</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <p>
          Double-click <code className="font-mono">watcher\\setup-watcher.cmd</code> in this project. It signs this Windows account in directly and starts itself at sign-in.
        </p>
        <p>
          The watcher waits while PokerStars is open, then checks the folder after you close it.
        </p>
      </div>
    </div>
  );
}
