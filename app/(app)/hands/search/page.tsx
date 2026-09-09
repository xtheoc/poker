import Link from "next/link";
import { MigrationNotice } from "@/components/migration-notice";
import {
  type HandMatch,
  MissingTableError,
  searchHands,
} from "@/lib/hands-store";
import { POSITIONS } from "@/lib/poker/charts";
import { optionalUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Find a hand" };

// Positions are imported rather than retyped. A local list here said "MP"
// where the parser writes "HJ", so that option matched nothing and read as
// "you have never played a hand there" — the worst kind of wrong, silent.

/**
 * Find a hand you played.
 *
 * Everything else in this app routes through mistakes, which quietly makes the
 * hands you played *correctly* unreachable — and those are the ones you want
 * when a hand class starts to feel like a problem before it has produced three
 * violations, or when you want to check that the fold you keep making really is
 * the one the chart wants.
 *
 * A plain GET form, so a result is a URL you can bookmark and the back button
 * behaves. No client JavaScript is involved: the browser already knows how to
 * submit a form, and a search box that needs a hydration bundle to work is a
 * worse search box.
 */
export default async function HandSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ hand?: string; pos?: string }>;
}) {
  const { hand, pos } = await searchParams;
  const session = await optionalUser();

  const handClass = hand?.trim() || undefined;
  const position = pos?.trim() || undefined;

  let matches: HandMatch[] = [];
  let needsMigration = false;

  if (session) {
    try {
      matches = await searchHands(session.supabase, session.userId, {
        handClass,
        position,
      });
    } catch (error) {
      if (error instanceof MissingTableError) needsMigration = true;
      else throw error;
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <Link
        href="/hands"
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        ← Hands
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold tracking-tight">
        Find a hand
      </h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Hand</span>
          <input
            name="hand"
            defaultValue={handClass ?? ""}
            placeholder="AKo"
            autoComplete="off"
            spellCheck={false}
            className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Position
          </span>
          <select
            name="pos"
            defaultValue={position ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Any</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {needsMigration ? (
          <MigrationNotice
            file="supabase/migrations/0003_hands.sql"
            what="The tables that store your hands do not exist yet."
          />
        ) : (
          <Results matches={matches} filtered={Boolean(handClass || position)} />
        )}
      </div>
    </main>
  );
}

function Results({
  matches,
  filtered,
}: {
  matches: HandMatch[];
  filtered: boolean;
}) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {filtered ? "No hands match that." : "No hands imported yet."}
      </p>
    );
  }

  return (
    <>
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        {filtered ? `${matches.length} matching` : "Most recent"}
        {matches.length === 100 && " · showing the first 100"}
      </p>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {matches.map((match) => (
          <li key={match.psHandId}>
            <Link
              href={`/hands/hand/${match.psHandId}`}
              className="-mx-2 flex items-baseline gap-3 rounded-lg px-2 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="font-mono font-medium">
                {match.cards.length > 0
                  ? match.cards.join(" ")
                  : (match.handClass ?? "—")}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {match.position ?? "—"} ·{" "}
                {match.playedAt.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span
                className={cn(
                  "ml-auto text-xs tabular-nums",
                  match.netBb > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : match.netBb < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-zinc-400",
                )}
              >
                {match.netBb > 0 ? "+" : ""}
                {match.netBb.toFixed(1)}bb
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
