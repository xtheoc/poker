import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { MigrationNotice } from "@/components/migration-notice";
import { StrategyNav } from "@/components/strategy-nav";
import { getStrategy, isLearningStrategy } from "@/lib/strategies";
import {
  loadStrategyReviewSummary,
  MissingStrategyReviewTablesError,
  type StrategyReviewSummary,
} from "@/lib/strategies/hand-review";
import { learningMap, nextLesson } from "@/lib/strategies/learning";
import { strategyProgressPageData } from "@/lib/strategies/progress-server";
import { optionalUser } from "@/lib/session";

export default async function StrategyPage({
  params,
}: PageProps<"/strategies/[strategyId]">) {
  const { strategyId } = await params;
  const strategy = getStrategy(strategyId);
  if (!strategy || !isLearningStrategy(strategy)) notFound();

  const { progress, migrationMissing } = await strategyProgressPageData(strategy.id);

  const map = learningMap(strategy.learning, progress);
  const next = nextLesson(strategy.learning, progress);
  const requiredSetup = strategy.learning.setup.filter((item) => item.required);
  const setupDone = requiredSetup.filter((item) => progress.completeSetupIds.includes(item.id)).length;
  const setupReady = setupDone === requiredSetup.length;
  const continuing = next ?? null;
  const session = await optionalUser();
  let review: StrategyReviewSummary | null = null;
  let reviewMigrationMissing = false;
  if (session) {
    try {
      review = await loadStrategyReviewSummary(
        session.supabase,
        session.userId,
        strategy.id,
      );
    } catch (error) {
      if (error instanceof MissingStrategyReviewTablesError) {
        reviewMigrationMissing = true;
      } else {
        throw error;
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <div className="mt-10 max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Strategy</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{strategy.name}</h1>
        <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">{strategy.tagline}</p>
      </div>

      {migrationMissing && (
        <div className="mt-8 max-w-2xl">
          <MigrationNotice
            file="supabase/migrations/0009_strategies.sql"
            what="Strategy setup and learning progress need their own tables."
          />
        </div>
      )}
      {reviewMigrationMissing && (
        <div className="mt-8 max-w-2xl">
          <MigrationNotice
            file="supabase/migrations/0010_strategy_hand_reviews.sql"
            what="Strategy-specific hand reviews need their own tables."
          />
        </div>
      )}

      <section className="mt-12 border-y border-zinc-200 py-6 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Continue</p>
        <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {!setupReady
                ? "Finish setup"
                : continuing
                  ? continuing.lesson.title
                  : "Preflop complete"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {!setupReady
                ? "Confirm the required study setup to open the first lesson."
                : continuing
                  ? continuing.lesson.summary
                  : "Your learned rules are ready in the playbook."}
            </p>
          </div>
          <Link
            href={`/strategies/${strategy.id}/${
              !setupReady ? "setup" : continuing ? "learn" : "playbook"
            }${continuing ? `/${continuing.lesson.id}` : ""}`}
            className="inline-flex shrink-0 items-center gap-2 text-sm font-medium underline underline-offset-4"
          >
            {!setupReady ? "Open setup" : continuing ? "Open lesson" : "Open playbook"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mt-10 grid divide-y divide-zinc-200 border-y border-zinc-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800">
        <Metric label="Hands" value={review ? String(review.hands) : "—"} />
        <Metric
          label="Net bb"
          value={review ? `${review.netBb >= 0 ? "+" : ""}${review.netBb.toFixed(1)}` : "—"}
        />
        <Metric label="VPIP" value={review?.vpip === null || !review ? "—" : `${review.vpip.toFixed(1)}%`} />
        <Metric label="PFR" value={review?.pfr === null || !review ? "—" : `${review.pfr.toFixed(1)}%`} />
      </section>

      <div className="mt-10 grid gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
        <Link href={`/strategies/${strategy.id}/drill`} className="group bg-white p-6 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <Target className="size-4 text-zinc-400" aria-hidden="true" />
          <p className="mt-9 text-lg font-semibold">Drill</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Practise the current subject until it is automatic.</p>
        </Link>
        <Link href={`/strategies/${strategy.id}/playbook`} className="group bg-white p-6 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <BookOpen className="size-4 text-zinc-400" aria-hidden="true" />
          <p className="mt-9 text-lg font-semibold">Playbook</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{map.filter((item) => item.state === "mastered").length} learned rules, ready to review.</p>
        </Link>
      </div>

      <div className="mt-14 flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Course progress</h2>
        <p className="text-sm text-zinc-500">Setup {setupDone}/{requiredSetup.length} · {map.filter((item) => item.state === "mastered").length}/{map.length}</p>
      </div>
      <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {map.map((item, index) => (
          <li key={item.lesson.id} className="flex items-center gap-4 py-4">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-300 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 font-medium">{item.lesson.title}</span>
            <span className="text-xs capitalize text-zinc-500">{item.state.replace("-", " ")}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4 first:pl-0 last:pr-0 sm:px-5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-400">{value}</p>
    </div>
  );
}
