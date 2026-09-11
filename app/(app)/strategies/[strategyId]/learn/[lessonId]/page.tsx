import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Target } from "lucide-react";
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
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <Link
        href={`/strategies/${strategy.id}/learn`}
        className="mt-8 inline-block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:hover:text-white"
      >
        Learning map
      </Link>
      <div className="mt-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{item.lesson.title}</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-500 dark:text-zinc-400">{item.lesson.summary}</p>
      </div>

      {item.lesson.playbook.length > 0 && (
        <div className="mt-9">
          {item.lesson.playbook.map((entry) => (
            <StrategyPlaybookEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <div className="mt-9 space-y-8">
        {item.lesson.assets.map((asset) => (
          <article key={asset.id} className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <h2 className="text-base font-semibold">{asset.title}</h2>
            {asset.body && (
              <div className="mt-3 max-w-2xl space-y-3 text-[0.9375rem] leading-7 text-zinc-600 dark:text-zinc-300">
                {asset.body.split(/\n\s*\n/).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
            <details className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              <summary className="cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-200">Sources</summary>
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
          </article>
        ))}
      </div>

      {item.lesson.id === "open-with-purpose" && (
        <div className="mt-12">
          <StrategyRangeReference strategy={strategy} />
        </div>
      )}

      <section className="mt-14 border-y border-zinc-200 py-7 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Target className="size-4" aria-hidden="true" />
          Mastery
        </div>
        <p className="mt-3 font-medium">
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
        <Link
          href={`/strategies/${strategy.id}/drill?lesson=${item.lesson.id}`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Drill this subject
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
