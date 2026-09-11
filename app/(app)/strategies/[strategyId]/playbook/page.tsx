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
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <div className="mt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Playbook</h1>
      </div>
      {entries.length > 0 ? (
        <StrategyPlaybook entries={entries} />
      ) : (
        <p className="mt-10 border-y border-zinc-200 py-6 text-sm text-zinc-500 dark:border-zinc-800">Your first mastered lesson will add its table rule here.</p>
      )}
    </main>
  );
}
