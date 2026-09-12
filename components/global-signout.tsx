"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Revoke all refresh sessions after a device or connection code is exposed. */
export function GlobalSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOutEverywhere = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { error: signOutError } = await createClient().auth.signOut({ scope: "global" });
    if (signOutError) {
      setError("Could not sign out everywhere. Try again.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }, [router]);

  return (
    <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <p className="text-sm font-medium">Security</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Use this if a sign-in link or automatic-import connection was exposed.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={signOutEverywhere}
        className="mt-3 text-xs text-rose-600 hover:text-rose-700 disabled:opacity-40 dark:text-rose-400 dark:hover:text-rose-300"
      >
        {busy ? "Signing out..." : "Sign out all devices"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
