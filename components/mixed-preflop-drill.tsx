"use client";

import { useCallback, useState } from "react";
import { ContextualPreflopDrill } from "@/components/contextual-preflop-drill";
import type { ChartSet } from "@/lib/poker/charts";
import type { ContextualPreflopSpot } from "@/lib/strategies/ctm-contextual";

type Result = { score: number; durationMs: number; answers: number };

/**
 * Free practice for the four pre-flop decision branches.
 *
 * This is deliberately a decision deck, not a course drill: it does not
 * write mastery progress. A correct run means the player identified the table
 * shape and action ten times in a row; the next run starts a fresh deck.
 */
export function MixedPreflopDrill({
  chartSet,
  initialSpots,
}: {
  chartSet: ChartSet;
  initialSpots: readonly ContextualPreflopSpot[];
}) {
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const finish = useCallback((value: Result) => {
    setResult(value);
  }, []);

  const again = useCallback(() => {
    setResult(null);
    setRun((value) => value + 1);
  }, []);

  if (result) {
    return (
      <div className="mx-auto max-w-md border-y border-zinc-200 py-12 text-center dark:border-zinc-800">
        <p className="text-4xl font-semibold tabular-nums">{result.answers}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">clean mixed pre-flop decisions</p>
        <button
          onClick={again}
          className="mt-7 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Again
        </button>
      </div>
    );
  }

  return (
    <ContextualPreflopDrill
      key={run}
      chartSet={chartSet}
      initialSpots={initialSpots}
      completionStreak={10}
      onMastery={finish}
      showFamily
      sizeRaises
    />
  );
}
