import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings2 } from "lucide-react";
import { StrategyNav } from "@/components/strategy-nav";
import { getLearningStrategy } from "@/lib/strategies";
import { learningMap } from "@/lib/strategies/learning";
import { strategyProgressPageData } from "@/lib/strategies/progress-server";

export default async function StrategyLearnPage({
  params,
}: PageProps<"/strategies/[strategyId]/learn">) {
  const { strategyId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) notFound();

  const { progress } = await strategyProgressPageData(strategy.id);
  const map = learningMap(strategy.learning, progress);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Course</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Learning map</h1>
        </div>
        <Link href={`/strategies/${strategy.id}/setup`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:hover:text-white">
          <Settings2 className="size-3.5" aria-hidden="true" />
          Setup
        </Link>
      </div>
      <ol className="mt-10 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {map.map((item, index) => (
          <li key={item.lesson.id} className="flex gap-4 py-6">
            <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
              item.state === "mastered"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : item.state === "in-progress" || item.state === "available"
                  ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                  : "border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
            }`}>{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              {item.state === "locked" ? (
                <h2 className="font-medium text-zinc-400 dark:text-zinc-600">{item.lesson.title}</h2>
              ) : (
                <Link href={`/strategies/${strategy.id}/learn/${item.lesson.id}`} className="font-medium underline underline-offset-4 decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:decoration-zinc-700 dark:hover:decoration-white">
                  {item.lesson.title}
                </Link>
              )}
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{item.lesson.summary}</p>
            </div>
            <span className="self-start pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{item.state.replace("-", " ")}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
