import { notFound } from "next/navigation";
import { StrategyNav } from "@/components/strategy-nav";
import { StrategyPlaybook } from "@/components/strategy-playbook";
import { getLearningStrategy } from "@/lib/strategies";
import { learningMap } from "@/lib/strategies/learning";
import { strategyProgressPageData } from "@/lib/strategies/progress-server";

export default async function StrategyPlaybookPage({
  params,
}: PageProps<"/strategies/[strategyId]/playbook">) {
  const { strategyId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) notFound();

  const { progress } = await strategyProgressPageData(strategy.id);
  const masteredIds = new Set(
    learningMap(strategy.learning, progress)
      .filter((item) => item.state === "mastered")
      .map((item) => item.lesson.id),
  );
  const entries = strategy.learning.lessons
    .filter((lesson) => masteredIds.has(lesson.id))
    .flatMap((lesson) => lesson.playbook);
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <div className="mt-10 flex items-end justify-between border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">At the table</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Playbook</h1>
        </div>
        <p className="hidden max-w-48 text-right text-xs leading-5 text-zinc-500 sm:block">Only mastered rules appear here.</p>
      </div>
      {entries.length > 0 ? (
        <StrategyPlaybook entries={entries} />
      ) : (
        <p className="mt-10 border-y border-zinc-200 py-6 text-sm text-zinc-500 dark:border-zinc-800">Your first mastered lesson will add its table rule here.</p>
      )}
    </main>
  );
}
