/**
 * Who is signed in, if anyone.
 *
 * Two entry points, because this app has two kinds of page. Most of it — the
 * trainer, the reading list, the hand analyser — works with no account at all
 * and simply cannot remember anything. A smaller set genuinely needs an
 * account, and those redirect.
 *
 * `optionalUser` never throws and never redirects, so a page can render its
 * signed-out state without special-casing an unconfigured database.
 */

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  /** Big-blind size in the user's currency, e.g. 0.02 for NL2. */
  big_blind: number;
  currency: string;
  /** PokerStars screen name — how the hero is identified in a hand history. */
  pokerstars_alias: string | null;
  daily_minutes: number;
  /**
   * Pages of a book per day, as a ceiling rather than a target.
   *
   * Sits beside `daily_minutes` and means the opposite kind of thing: minutes
   * are how long a drill should take, pages are how far you are allowed to get
   * before the reader stops opening new sections.
   */
  daily_pages: number;
  onboarded_at: string | null;
}

export interface Session {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  profile: Profile | null;
}

/**
 * The session, or null when there is nobody signed in.
 *
 * Also returns null when Supabase has not been configured, which is the state
 * the app starts in. That is deliberately indistinguishable from being signed
 * out: both mean "nothing can be saved", and every caller wants to do the same
 * thing about it.
 */
export async function optionalUser(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  // getUser() revalidates with the auth server rather than trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile | null) ?? null,
  };
}

/** The session, redirecting to sign-in when there is none. */
export async function requireUser(): Promise<Session> {
  const session = await optionalUser();
  if (!session) redirect("/login");
  return session;
}

/**
 * Today's date in the user's own timezone.
 *
 * A drill finished at 1am should count for the night it felt like, not for
 * whatever calendar day the server happens to be in. Streaks that disagree with
 * the user's sense of "today" are how a daily habit quietly dies.
 */
export function localDate(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // An unknown timezone should not take a page down; UTC is a safe fallback.
    return now.toISOString().slice(0, 10);
  }
}
