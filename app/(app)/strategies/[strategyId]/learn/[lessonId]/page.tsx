import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { StrategyRangeReference } from "@/components/strategy-range-reference";
import { StrategyNav } from "@/components/strategy-nav";
import { StrategyPlaybookEntry } from "@/components/strategy-playbook";
import { getLearningStrategy } from "@/lib/strategies";
import { learningMap } from "@/lib/strategies/learning";
import { strategyProgressPageData } from "@/lib/strategies/progress-server";

export default async function StrategyLessonPage({
  params,
}: PageProps<"/strategies/[strategyId]/learn/[lessonId]">) {
  const { strategyId, lessonId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) notFound();

  const { progress } = await strategyProgressPageData(strategy.id);
  const item = learningMap(strategy.learning, progress).find(
    (candidate) => candidate.lesson.id === lessonId,
  );
  if (!item || item.state === "locked") notFound();

  const sources = new Map(strategy.learning.sources.map((source) => [source.id, source]));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <Link
        href={`/strategies/${strategy.id}/learn`}
        className="mt-8 inline-block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:hover:text-white"
      >
        Learning map
      </Link>
      <div className="mt-8 border-b border-zinc-200 pb-7 dark:border-zinc-800">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">{item.state === "mastered" ? "Mastered rule" : "Current lesson"}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{item.lesson.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-500 dark:text-zinc-400">{item.lesson.summary}</p>
      </div>

      {item.lesson.playbook.length > 0 && (
        <div className="mt-8 max-w-3xl">
          {item.lesson.playbook.map((entry) => (
            <StrategyPlaybookEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <div className="mt-12 max-w-3xl space-y-10">
        {item.lesson.assets.map((asset, index) => (
          <article key={asset.id} className="grid gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:grid-cols-[5.5rem_1fr] sm:gap-6">
            <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500 sm:block">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span className="sm:mt-2 sm:block">Rule</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{asset.title}</h2>
            {asset.body && (
              <div className="mt-4 max-w-2xl space-y-4 text-[0.9375rem] leading-7 text-zinc-600 dark:text-zinc-300">
                {asset.body.split(/\n\s*\n/).map((paragraph, paragraphIndex) => (
                  <p key={paragraph} className={paragraphIndex === 0 ? "text-[1.0625rem] font-medium leading-7 text-zinc-900 dark:text-zinc-100" : undefined}>{paragraph}</p>
                ))}
              </div>
            )}
            <details className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
              <summary className="flex cursor-pointer list-none items-center gap-2 select-none hover:text-zinc-900 dark:hover:text-zinc-200"><BookOpen className="size-3" aria-hidden="true" /> Sources</summary>
              <ul className="mt-3 space-y-1.5">
              {asset.sources.map((reference) => {
                const source = sources.get(reference.sourceId);
                return (
                  <li key={`${asset.id}-${reference.sourceId}-${reference.label}`}>
                    {source?.title ?? reference.sourceId} · pp. {reference.pages.join(", ")} · {reference.label}
                  </li>
                );
              })}
              </ul>
            </details>
            </div>
          </article>
        ))}
      </div>

      {item.lesson.id === "open-with-purpose" && (
        <div className="mt-12">
          <StrategyRangeReference strategy={strategy} />
        </div>
      )}

      <section className="mt-14 max-w-3xl rounded-lg border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/30 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Target className="size-4" aria-hidden="true" />
            To unlock the next rule
          </div>
          <p className="mt-2 font-medium leading-6">
          {item.lesson.mastery.map((requirement) => {
            if (requirement.kind === "drill") {
              const run = requirement.minimumAnswers
                ? `${requirement.minimumAnswers} clean answers`
                : "a clean run";
              return requirement.minimumRuns === 1
                ? run
                : `${requirement.minimumRuns} runs of ${run}`;
            }
            if (requirement.kind === "quiz") return `${requirement.minimumScore}% on ${requirement.quizId}`;
            return `${requirement.minimumScore}% recall`;
          }).join(" · ")}
        </p>
        </div>
        <Link
          href={`/strategies/${strategy.id}/drill?lesson=${item.lesson.id}`}
          className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:mt-0"
        >
          Drill this subject
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
