import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, ClipboardList, Hand, Target } from "lucide-react";
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
  const preflop = map.slice(0, 7);
  const postflop = map.slice(7);
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
      <header className="mt-10 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Active strategy</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{strategy.name}</h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{strategy.tagline}</p>
      </header>

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

      <section className="grid border-b border-zinc-200 dark:border-zinc-800 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="py-8 lg:pr-10">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Next</p>
          <div className="mt-4 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {!setupReady
                ? "Finish setup"
                : continuing
                  ? continuing.lesson.title
                  : "Preflop complete"}
            </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
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
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {!setupReady ? "Open setup" : continuing ? "Open lesson" : "Open playbook"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="border-t border-zinc-200 py-8 lg:border-t-0 lg:border-l lg:pl-10 dark:border-zinc-800">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Path</p>
          <div className="mt-5 space-y-4">
            <Path label="Pre-flop" done={preflop.filter((item) => item.state === "mastered").length} total={preflop.length} />
            <Path label="Post-flop" done={postflop.filter((item) => item.state === "mastered").length} total={postflop.length} />
          </div>
        </div>
      </section>

      {review && (
        <section className="grid divide-y divide-zinc-200 border-b border-zinc-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800">
          <Metric label="Hands" value={String(review.hands)} />
          <Metric label="Net" value={`${review.netBb >= 0 ? "+" : ""}${review.netBb.toFixed(1)}bb`} />
          <Metric label="VPIP" value={review.vpip === null ? "—" : `${review.vpip.toFixed(1)}%`} />
          <Metric label="PFR" value={review.pfr === null ? "—" : `${review.pfr.toFixed(1)}%`} />
        </section>
      )}

      <section className="mt-10">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Workspace</p>
      <div className="mt-4 grid gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
        <Link href={`/strategies/${strategy.id}/learn`} className="group bg-white p-6 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <BookOpen className="size-4 text-zinc-400" aria-hidden="true" />
          <p className="mt-9 text-lg font-semibold">Learn</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Read the next rule, then unlock it with practice.</p>
        </Link>
        <Link href={`/strategies/${strategy.id}/drill`} className="group bg-white p-6 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <Target className="size-4 text-zinc-400" aria-hidden="true" />
          <p className="mt-9 text-lg font-semibold">Drill</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Practise the current subject until it is automatic.</p>
        </Link>
        <Link href={`/strategies/${strategy.id}/playbook`} className="group bg-white p-6 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <ClipboardList className="size-4 text-zinc-400" aria-hidden="true" />
          <p className="mt-9 text-lg font-semibold">Playbook</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{map.filter((item) => item.state === "mastered").length} learned rules, ready to review.</p>
        </Link>
        <Link href={`/strategies/${strategy.id}/hands`} className="group bg-white p-6 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <Hand className="size-4 text-zinc-400" aria-hidden="true" />
          <p className="mt-9 text-lg font-semibold">Hands</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Review only hands that belong to this strategy.</p>
        </Link>
      </div>
      </section>
    </main>
  );
}

function Path({ label, done, total }: { label: string; done: number; total: number }) {
  const percentage = total === 0 ? 0 : (done / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-zinc-500">{done}/{total}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
      </div>
    </div>
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
