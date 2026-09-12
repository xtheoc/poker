"use client";

import { Copy, FolderSync } from "lucide-react";
import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Connection = { code: string };

function connectionCode(value: Record<string, string>): string {
  return `poker_watch_${btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;
}

export function HandHistoryWatcher() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      const refreshToken = data.session?.refresh_token;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (sessionError || !refreshToken || !url || !anonKey) {
        throw new Error("Sign in again before connecting automatic import.");
      }
      setConnection({
        code: connectionCode({
          endpoint: new URL("/api/hands/import", window.location.origin).toString(),
          supabaseUrl: url,
          anonKey,
          refreshToken,
        }),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect automatic import.");
    } finally {
      setBusy(false);
    }
  }, []);

  const copyKey = useCallback(async () => {
    if (!connection) return;
    await navigator.clipboard.writeText(connection.code);
    setCopied(true);
  }, [connection]);

  return (
    <div className="border-y border-zinc-200 py-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FolderSync className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium">Automatic import</p>
        </div>
      </div>

      {connection ? (
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-zinc-600 dark:text-zinc-300">
            Open <code className="font-mono text-xs">watcher\\setup-watcher.cmd</code> in this project, then paste this connection code when asked. It is shown once.
          </p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs dark:bg-zinc-900">
              {connection.code}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            The watcher waits while PokerStars is open, then checks the folder after you close it and when you next sign in.
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={connect}
          className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          {busy ? "Connecting..." : "Connect folder"}
        </button>
      )}
      {error && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
