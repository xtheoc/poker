import { notFound } from "next/navigation";
import Link from "next/link";
import { HandHistoryWatcher } from "@/components/hand-history-watcher";
import { HandImport } from "@/components/hand-import";
import { MigrationNotice } from "@/components/migration-notice";
import { StrategyHandReview } from "@/components/strategy-hand-review";
import { StrategyNav } from "@/components/strategy-nav";
import { getLearningStrategy } from "@/lib/strategies";
import {
  loadStrategyReviewSummary,
  MissingStrategyReviewTablesError,
  loadStrategySessionHands,
} from "@/lib/strategies/hand-review";
import { optionalUser } from "@/lib/session";
import { groupSessions, statsFor, type PlaySession } from "@/lib/sessions";

export default async function StrategyHandsPage({
  params,
}: PageProps<"/strategies/[strategyId]/hands">) {
  const { strategyId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) notFound();

  const session = await optionalUser();
  if (!session) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
        <header className="mt-10">
          <h1 className="text-4xl font-semibold tracking-tight">Hands</h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to review this strategy against your own hands.
          </p>
        </header>
      </main>
    );
  }

  let summary;
  let hands;
  try {
    [summary, hands] = await Promise.all([
      loadStrategyReviewSummary(session.supabase, session.userId, strategy.id),
      loadStrategySessionHands(session.supabase, session.userId, strategy.id),
    ]);
  } catch (error) {
    if (error instanceof MissingStrategyReviewTablesError) {
      return (
        <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
          <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
          <div className="mt-10">
            <MigrationNotice
              file="0010_strategy_hand_reviews.sql"
              what="strategy-specific hand reviews"
            />
          </div>
        </main>
      );
    }
    throw error;
  }
  const sessions = groupSessions(hands);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:mt-10 sm:text-4xl">Hands</h1>

      <section className="mt-6 grid grid-cols-3 border-y border-zinc-200 dark:border-zinc-800 sm:mt-8 sm:grid-cols-5">
        <Metric label="Hands" value={String(summary.hands)} />
        <Metric label="Net" value={`${summary.netBb >= 0 ? "+" : ""}${summary.netBb.toFixed(1)}bb`} />
        <Metric label="Accuracy" value={percent(summary.accuracy)} />
        <Metric className="hidden sm:block" label="VPIP" value={percent(summary.vpip)} />
        <Metric className="hidden sm:block" label="PFR" value={percent(summary.pfr)} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Sessions</h2>
        {sessions.length > 0 ? (
          <div className="mt-3 divide-y border-y border-zinc-200 dark:border-zinc-800 dark:divide-zinc-800">
            {sessions.map((play) => (
              <SessionRow key={play.id} strategyId={strategy.id} play={play} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            No sessions yet.
          </p>
        )}
      </section>

      <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Add hands</h2>
        <div className="mt-3">
          <HandHistoryWatcher />
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Import a file instead
          </summary>
          <div className="mt-3">
            <HandImport
              signedIn
              sessionHref={(id) => `/strategies/${strategy.id}/hands/${id}`}
            />
          </div>
        </details>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Review earlier imports
          </summary>
          <div className="mt-3">
            <StrategyHandReview strategyId={strategy.id} />
          </div>
        </details>
      </section>

      <p className="mt-10 text-xs text-zinc-400 dark:text-zinc-500">
        {strategy.learning.tracking.label} · filter {strategy.learning.tracking.filterVersion}
      </p>
    </main>
  );
}

function Metric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`border-r border-zinc-200 py-3 text-center last:border-r-0 dark:border-zinc-800 sm:px-4 sm:text-left sm:first:pl-0 ${className}`}>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function SessionRow({
  strategyId,
  play,
}: {
  strategyId: string;
  play: PlaySession;
}) {
  const stats = statsFor(play.hands);
  const date = play.startedAt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = play.startedAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/strategies/${strategyId}/hands/${play.id}`}
      className="block px-1 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900 sm:grid sm:grid-cols-[minmax(10rem,1fr)_auto_auto_auto_auto] sm:items-baseline sm:gap-x-5"
    >
      <div className="flex items-baseline justify-between gap-3 sm:contents">
        <span className="font-medium">{date} · {time}</span>
        <span className={stats.netBb >= 0 ? "text-right tabular-nums text-emerald-600 dark:text-emerald-400" : "text-right tabular-nums text-rose-600 dark:text-rose-400"}>
          {stats.netBb >= 0 ? "+" : ""}{stats.netBb.toFixed(1)}bb
        </span>
      </div>
      <div className="mt-1 flex gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:contents">
        <span className="sm:text-right">{stats.hands} {stats.hands === 1 ? "hand" : "hands"}</span>
        <span className="sm:text-right">{stats.charted > 0 ? `${stats.accuracy.toFixed(0)}% right` : "no graded spots"}</span>
        <span className="text-zinc-400 dark:text-zinc-500 sm:text-right">
          {stats.mistakes > 0 ? `${stats.mistakes} ${stats.mistakes === 1 ? "mistake" : "mistakes"}` : "clean"}
        </span>
      </div>
    </Link>
  );
}

function percent(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}
