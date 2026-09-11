"use client";

import { useCallback, useRef, useState } from "react";
import type { CtmSizingSpot } from "@/lib/strategies/ctm-sizing";
import { describeCtmSizingSpot, scoreCtmSizing } from "@/lib/strategies/ctm-sizing";
import { cn } from "@/lib/utils";

const BETS = [3, 4, 5, 6, 7, 8, 9, 10];

export function CtmSizingDrill({
  initialSpots,
  onComplete,
}: {
  initialSpots: readonly CtmSizingSpot[];
  onComplete: (result: { score: number; durationMs: number; answers: number }) => void;
}) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: number; score: number } | null>(null);
  const startedAt = useRef<number | null>(null);
  const reported = useRef(false);
  const correctCount = useRef(0);
  const spot = initialSpots[index];

  const answer = useCallback((size: number) => {
    if (!spot || chosen !== null || result !== null) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    setChosen(size);
    const correct = size === spot.expectedBb;
    if (correct) {
      correctCount.current += 1;
    }
  }, [chosen, result, spot]);

  const next = useCallback(() => {
    if (chosen === null || reported.current) return;
    if (index + 1 < initialSpots.length) {
      setIndex((value) => value + 1);
      setChosen(null);
      return;
    }

    reported.current = true;
    const final = scoreCtmSizing(correctCount.current, initialSpots.length);
    setResult(final);
    onComplete({
      score: final.score,
      durationMs: Date.now() - (startedAt.current ?? Date.now()),
      answers: initialSpots.length,
    });
  }, [chosen, index, initialSpots.length, onComplete]);

  const restart = useCallback(() => {
    setIndex(0);
    setChosen(null);
    setResult(null);
    startedAt.current = null;
    reported.current = false;
    correctCount.current = 0;
  }, []);

  if (result) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <p className="text-5xl font-semibold tabular-nums">{result.score}%</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {result.correct} of {initialSpots.length} sizing decisions
        </p>
        <button onClick={restart} className="mt-8 w-full max-w-xs rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
          Again
        </button>
      </div>
    );
  }
  if (!spot) return null;

  const correct = chosen === spot.expectedBb;
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex w-full max-w-sm items-baseline justify-between">
        <span className="text-2xl font-semibold">{spot.position}</span>
        <span className="text-xs text-zinc-400">{index + 1} of {initialSpots.length}</span>
      </div>
      <p className="mt-2 w-full max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {describeCtmSizingSpot(spot)}
      </p>
      <p className="mt-8 text-sm text-zinc-500">Raise to</p>
      <div className="mt-3 grid w-full max-w-sm grid-cols-4 gap-2">
        {BETS.map((size) => (
          <button
            key={size}
            disabled={chosen !== null}
            onClick={() => answer(size)}
            className={cn(
              "rounded-xl border py-4 text-sm font-medium tabular-nums transition",
              "border-zinc-300 dark:border-zinc-700",
              chosen === null && "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              chosen === size && (correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-rose-500 bg-rose-500 text-white"),
              chosen !== null && size === spot.expectedBb && chosen !== size && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {size}bb
          </button>
        ))}
      </div>
      {chosen !== null && (
        <button onClick={next} className="mt-7 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
          {correct ? "Next" : `${spot.expectedBb}bb`} →
        </button>
      )}
    </div>
  );
}
