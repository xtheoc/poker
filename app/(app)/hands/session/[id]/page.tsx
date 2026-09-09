import Link from "next/link";
import { notFound } from "next/navigation";
import { LeakList } from "@/components/leak-list";
import { SessionActions } from "@/components/session-actions";
import { loadSessionHands, loadViolations } from "@/lib/hands-store";
import { findLeaks } from "@/lib/leaks";
import { requireUser } from "@/lib/session";
import {
  type SessionStats,
  type Stat,
  groupSessions,
  sessionContaining,
  statsFor,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Session" };

/**
 * The session review.
 *
 * Ordered by how far each number can be trusted, which is not the order these
 * are usually presented in.
 *
 * **Preflop accuracy leads**, because it is the only figure here that is a fact
 * rather than an estimate: every charted decision was either inside the range
 * or outside it, and forty of them say something true. **The result comes
 * second**, clearly marked as one session — at a realistic win rate a single
 * sitting is almost entirely variance, and reading it as feedback is how people
 * talk themselves out of a winning strategy. **The conventional stats come
 * last**, each carrying the sample it needs before it means anything.
 *
 * The alternative — a dashboard of six confident percentages from sixty hands —
 * is what most tools do, and every one of those numbers would be noise.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();

  const [hands, violations] = await Promise.all([
    loadSessionHands(session.supabase, session.userId),
    loadViolations(session.supabase, session.userId),
  ]);

  const play = sessionContaining(groupSessions(hands), id);
  if (!play) notFound();

  const stats = statsFor(play.hands);
  const handIds = new Set(play.hands.map((h) => h.psHandId));
  const mine = violations.filter((v) => handIds.has(v.handId));

  // Leaks are computed over the whole history rather than this sitting alone:
  // the entire point of storing hands is that "three times tonight" and "three
  // times across three evenings" are different findings. Only the leaks this
  // session actually touched are shown.
  const leaks = findLeaks(violations).filter((leak) =>
    mine.some((v) => v.nodeId === leak.nodeId && v.kind === leak.kind),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <Link
          href="/hands"
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          ← All sessions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {play.startedAt.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {play.startedAt.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {stats.minutes > 0 && ` · ${stats.minutes} minutes`} · {stats.hands}{" "}
          hands
        </p>
        <div className="mt-2">
          {/* Sends you back to the list afterwards — staying on the page of a
              session that no longer exists would 404 on the next refresh. */}
          <SessionActions
            handIds={play.hands.map((h) => h.psHandId)}
            label="this session"
            onDeleted="/hands"
          />
        </div>
      </header>

      <div className="space-y-8">
        <Headline stats={stats} />

        {/* Two sections where there used to be one, because the old one was
            lying. It was headed "Mistakes" and rendered the cross-session leak
            list, whose evidence includes hands from other evenings — so a
            session with two mistakes could show nine hands under a heading
            promising this session's. Now: what happened here, then what it is
            part of. */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            Mistakes here
            {mine.length > 0 && (
              <span className="ml-2 font-normal text-zinc-400">
                {mine.length}
              </span>
            )}
          </h2>
          {mine.length === 0 ? (
            <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              {stats.charted === 0
                ? "Nothing here reached a spot the chart covers."
                : `None in ${stats.charted} graded ${
                    stats.charted === 1 ? "spot" : "spots"
                  }.`}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {mine.map((v, i) => (
                <li key={`${v.handId}-${i}`}>
                  <Link
                    href={`/hands/hand/${v.handId}`}
                    className="-mx-2 flex flex-wrap items-baseline gap-2 rounded-lg px-2 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono font-semibold">{v.hand}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {v.spot} · you {v.chosen}ed, chart says {v.expected}
                    </span>
                    <span className="ml-auto text-xs text-zinc-400">
                      replay →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {leaks.length > 0 && (
          <section>
            <h2 className="mb-1 text-sm font-semibold">Habits this fed</h2>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Counted across every session, not just this one. That is the whole
              reason the hands are stored.
            </p>
            <LeakList leaks={leaks} violations={violations} />
          </section>
        )}

        <Result stats={stats} />
        <Conventional stats={stats} />
      </div>

      {leaks.some((l) => l.drillable) && (
        <Link
          href="/drill"
          className="mt-10 block rounded-xl bg-zinc-900 py-3 text-center text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Drill these spots
        </Link>
      )}
    </main>
  );
}

/** The one number here that is a fact rather than an estimate. */
function Headline({ stats }: { stats: SessionStats }) {
  if (stats.charted === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Preflop accuracy</h2>
      <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              "text-4xl font-semibold tabular-nums",
              stats.accuracy >= 90
                ? "text-emerald-600 dark:text-emerald-400"
                : stats.accuracy >= 75
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400",
            )}
          >
            {stats.accuracy.toFixed(0)}%
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {stats.charted - stats.mistakes} of {stats.charted} charted spots
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * The result, demoted on purpose.
 *
 * It used to be two large cards directly under accuracy, which reads as a
 * second score. Over one sitting it is almost entirely variance — a bb/100 from
 * sixty hands is not a win rate, it is a coin flip with a decimal point — and
 * presenting it at the same weight as accuracy invites exactly the reasoning
 * this app exists to prevent: playing well, running badly, and concluding the
 * strategy is wrong. One quiet line, below the mistakes.
 */
function Result({ stats }: { stats: SessionStats }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Result</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <span
          className={cn(
            "font-medium tabular-nums",
            stats.netBb > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : stats.netBb < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-500",
          )}
        >
          {stats.netBb > 0 ? "+" : ""}
          {stats.netBb.toFixed(1)}bb
        </span>{" "}
        over {stats.hands} {stats.hands === 1 ? "hand" : "hands"} ·{" "}
        <span className="tabular-nums">
          {stats.bbPer100 > 0 ? "+" : ""}
          {stats.bbPer100.toFixed(0)}
        </span>{" "}
        bb/100 — mostly variance at this length.
      </p>
    </section>
  );
}

/**
 * The stats every other tool shows, each with the sample it needs.
 *
 * Shown because they are true descriptions of this session, and labelled
 * because at this volume none of them is yet a description of the player.
 */
function Conventional({ stats }: { stats: SessionStats }) {
  const rows: Array<{ label: string; stat: Stat; note: string }> = [
    { label: "VPIP", stat: stats.vpip, note: "hands played voluntarily" },
    { label: "PFR", stat: stats.pfr, note: "hands raised preflop" },
    { label: "WWSF", stat: stats.wwsf, note: "won when saw flop" },
    { label: "WTSD", stat: stats.wtsd, note: "went to showdown" },
    { label: "W$SD", stat: stats.wsd, note: "won money at showdown" },
  ];

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Stats</h2>
      {/* The sample column on the right is what keeps these honest — it says
          "50 / 300" rather than claiming a number that has not settled. That
          replaces the paragraph that used to explain it. */}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline gap-3 py-2">
            <span className="w-14 text-sm font-medium">{row.label}</span>
            <span className="text-sm tabular-nums">
              {row.stat.samples === 0 ? "—" : `${row.stat.value.toFixed(0)}%`}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {row.note}
            </span>
            <span className="ml-auto text-right text-[11px] text-zinc-400 dark:text-zinc-500">
              {row.stat.reliable
                ? "settled"
                : `${row.stat.samples} / ${row.stat.threshold.toLocaleString()}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
