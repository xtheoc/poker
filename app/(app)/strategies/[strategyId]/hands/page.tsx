import { notFound } from "next/navigation";
import { ClipboardList, TrendingDown } from "lucide-react";
import { LeakList } from "@/components/leak-list";
import { MigrationNotice } from "@/components/migration-notice";
import { StrategyHandReview } from "@/components/strategy-hand-review";
import { findLeaks } from "@/lib/leaks";
import { StrategyNav } from "@/components/strategy-nav";
import { getLearningStrategy } from "@/lib/strategies";
import {
  lessonForNode,
  loadStrategyCoverage,
  loadStrategyReviewSummary,
  loadStrategyViolations,
  MissingStrategyDecisionTablesError,
  MissingStrategyReviewTablesError,
} from "@/lib/strategies/hand-review";
import { optionalUser } from "@/lib/session";

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
  let violations;
  let coverage;
  try {
    [summary, violations, coverage] = await Promise.all([
      loadStrategyReviewSummary(session.supabase, session.userId, strategy.id),
      loadStrategyViolations(session.supabase, session.userId, strategy.id),
      loadStrategyCoverage(session.supabase, session.userId, strategy.id),
    ]);
  } catch (error) {
    if (error instanceof MissingStrategyDecisionTablesError) {
      return (
        <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
          <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
          <div className="mt-10">
            <MigrationNotice
              file="0011_strategy_decisions.sql"
              what="strategy decision coverage"
            />
          </div>
        </main>
      );
    }
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

  const leaks = findLeaks(violations);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <div className="mt-10 flex flex-wrap items-end justify-between gap-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          <ClipboardList className="size-3.5" aria-hidden="true" />
          Review
        </div>
        <StrategyHandReview strategyId={strategy.id} />
      </div>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Hands</h1>

      <section className="mt-8 grid grid-cols-2 border-y border-zinc-200 dark:border-zinc-800 sm:grid-cols-5">
        <Metric label="Hands" value={String(summary.hands)} />
        <Metric label="Net" value={`${summary.netBb >= 0 ? "+" : ""}${summary.netBb.toFixed(1)}bb`} />
        <Metric label="VPIP" value={percent(summary.vpip)} />
        <Metric label="PFR" value={percent(summary.pfr)} />
        <Metric label="Accuracy" value={percent(summary.accuracy)} />
      </section>

      <section className="mt-10 border-y border-zinc-200 py-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">Coverage</h2>
          <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
            {coverage.total} decisions seen
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Coverage label="Gradeable" value={coverage.gradeable} />
          <Coverage label="Right" value={coverage.correct} />
          <Coverage label="Drill only" value={coverage.drillOnly} />
          <Coverage label="Not supported" value={coverage.unsupported} />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <TrendingDown className="size-4 text-zinc-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold">What to fix</h2>
        </div>
        {leaks.length > 0 ? (
          <div className="mt-4">
            <LeakList
              leaks={leaks}
              violations={violations}
              limit={5}
              drillHref={(leak) => {
                const lesson = lessonForNode(leak.nodeId);
                return lesson
                  ? `/strategies/${strategy.id}/drill?lesson=${lesson}`
                  : `/strategies/${strategy.id}/drill`;
              }}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            {summary.hands === 0
              ? "No matching hands reviewed yet."
              : summary.charted === 0
                ? "No preflop decisions matched a rule yet."
                : "No recorded mistakes in the reviewed decisions."}
          </p>
        )}
      </section>

      <p className="mt-10 text-xs text-zinc-400 dark:text-zinc-500">
        {strategy.learning.tracking.label} · filter {strategy.learning.tracking.filterVersion}
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-zinc-200 py-4 pr-4 last:border-b-0 sm:border-r sm:border-b-0 sm:px-4 sm:first:pl-0 sm:last:border-r-0">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Coverage({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function percent(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}
