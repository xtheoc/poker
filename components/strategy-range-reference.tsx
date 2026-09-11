import { PreflopGrid } from "@/components/preflop-grid";
import type { Strategy } from "@/lib/strategies";

/** A source-visible check on the exact chart the learner is about to drill. */
export function StrategyRangeReference({ strategy }: { strategy: Strategy }) {
  if (!strategy.rangeReference) return null;

  return (
    <section className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-xl font-medium">Opening ranges to review</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        These are the exact actions used by the drill and hand review. Red is
        raise, green is call. Review them before attempting the range exercise.
      </p>

      <div className="mt-7 space-y-10">
        {strategy.rangeReference.map((range) => {
          const node = strategy.chartSet.nodes.find(
            (candidate) =>
              candidate.key.scenario === "rfi" &&
              candidate.key.position === range.position,
          );
          if (!node) return null;

          return (
            <article key={range.position}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold">{range.position}</h3>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  folds to you
                </span>
              </div>
              {range.raise && (
                <p className="mt-2 font-mono text-xs leading-relaxed text-rose-600 dark:text-rose-400">
                  raise {range.raise}
                </p>
              )}
              {range.call && (
                <p className="mt-1 font-mono text-xs leading-relaxed text-emerald-600 dark:text-emerald-400">
                  call {range.call}
                </p>
              )}
              {range.caveat && (
                <p className="mt-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                  {range.caveat}
                </p>
              )}
              <div className="mt-4 max-w-xl">
                <PreflopGrid node={node} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
