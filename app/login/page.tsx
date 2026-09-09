"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign in by emailed link.
 *
 * No password, deliberately. A password has to be chosen, stored, reset and
 * eventually leaked; a link to an inbox the user already controls does the same
 * job with none of that. For a single-user study tool the tradeoff is not close.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setState("sent");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Could not send the link.",
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        An account is only needed to remember things — your drill history, your
        leaks, and where you are in a book.
      </p>

      {state === "sent" ? (
        <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="font-medium">Check your email.</p>
          <p className="mt-1">
            There is a sign-in link waiting at {email}. It opens this app back up
            already signed in.
          </p>
        </div>
      ) : (
        <form onSubmit={send} className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
          </label>

          <button
            type="submit"
            disabled={state === "sending" || !email}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {state === "sending" ? "Sending…" : "Email me a link"}
          </button>

          {state === "error" && (
            <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              {message}
            </p>
          )}
        </form>
      )}

      <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/drill" className="underline">
          The drill
        </Link>{" "}
        works signed out. Everything that remembers does not.
      </p>
    </main>
  );
}
