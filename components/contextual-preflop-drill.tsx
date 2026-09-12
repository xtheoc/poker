"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { PokerTable } from "@/components/poker-table";
import {
  squeezeCallersFor,
  wagersFor,
  type ActionKind,
  type ChartSet,
} from "@/lib/poker/charts";
import {
  CONTEXTUAL_FAMILY_LABELS,
  contextualRaiseSizeBb,
  type ContextualPreflopSpot,
  contextualRuleLabel,
} from "@/lib/strategies/ctm-contextual";
import { cn } from "@/lib/utils";

const FEEDBACK_MS = 700;

export function ContextualPreflopDrill({
  chartSet,
  initialSpots,
  completionStreak,
  onMastery,
  showFamily = false,
  sizeRaises = false,
}: {
  chartSet: ChartSet;
  initialSpots: readonly ContextualPreflopSpot[];
  completionStreak: number;
  onMastery: (result: { score: number; durationMs: number; answers: number }) => void;
  /** General practice reveals the branch only after a correction. */
  showFamily?: boolean;
  /** A raise in free practice includes its source-derived size. */
  sizeRaises?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answer, setAnswer] = useState<ActionKind | null>(null);
  const [raiseSize, setRaiseSize] = useState(3);
  const [sizingCorrect, setSizingCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef<number | null>(null);
  const answers = useRef(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spot = initialSpots[index];

  const advance = useCallback(() => {
    setAnswer(null);
    setRaiseSize(3);
    setSizingCorrect(null);
    setIndex((value) => (value + 1) % initialSpots.length);
  }, [initialSpots.length]);

  const expectedRaiseSize = spot ? contextualRaiseSizeBb(spot, chartSet) : null;
  const requiresSize = sizeRaises && expectedRaiseSize !== null;

  const grade = useCallback(
    (chosen: ActionKind, chosenSize?: number) => {
      if (!spot || answer !== null || finished) return;
      if (startedAt.current === null) startedAt.current = Date.now();
      answers.current++;
      setAnswer(chosen);
      const sizeRight = !requiresSize || chosen !== "raise" || chosenSize === expectedRaiseSize;
      setSizingCorrect(sizeRight);

      if (chosen !== spot.expected || !sizeRight) {
        setStreak(0);
        return;
      }

      const next = streak + 1;
      setStreak(next);
      if (next >= completionStreak) {
        setFinished(true);
        onMastery({
          score: 100,
          durationMs: Date.now() - (startedAt.current ?? Date.now()),
          answers: answers.current,
        });
        return;
      }
      advanceTimer.current = setTimeout(advance, FEEDBACK_MS);
    },
    [advance, answer, completionStreak, expectedRaiseSize, finished, onMastery, requiresSize, spot, streak],
  );

  const choose = useCallback((chosen: ActionKind) => {
    grade(chosen, chosen === "raise" && requiresSize ? raiseSize : undefined);
  }, [grade, raiseSize, requiresSize]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (finished) return;
      if (answer) {
        if (["f", "c", "r", " ", "enter"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          if (answer !== spot?.expected) advance();
        }
        return;
      }
      const action: Record<string, ActionKind> = { f: "fold", c: "call", r: "raise" };
      const chosen = action[event.key.toLowerCase()];
      if (!chosen) return;
      event.preventDefault();
      choose(chosen);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, answer, choose, finished, spot?.expected]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  if (!spot) return null;
  if (finished) {
    return (
      <div className="border-y border-zinc-200 py-12 text-center dark:border-zinc-800">
        <p className="text-4xl font-semibold tabular-nums">{completionStreak}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          clean contextual decisions
        </p>
      </div>
    );
  }

  const correct = answer === spot.expected && sizingCorrect !== false;
  const maximumRaise = Math.max(spot.spot.stackBb, 4);
  const adjustRaise = (amount: number) => {
    setRaiseSize((current) => Math.max(2, Math.min(maximumRaise, current + amount)));
  };
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex w-full max-w-sm items-baseline justify-between">
        <span className="text-3xl font-semibold tabular-nums">{streak}</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {completionStreak} clean in a row
        </span>
      </div>
      <div className="mt-4 w-full">
        <PokerTable
          position={spot.spot.position}
          villain={spot.spot.villain}
          callers={squeezeCallersFor(spot.node)}
          wagers={wagersFor(spot.node, chartSet)}
          cards={spot.cards}
          playerTypes={spot.playerTypes}
        />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{spot.spot.stackBb}bb effective</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
            spot.spot.inPosition
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
          )}
        >
          {spot.spot.inPosition ? "IP" : "OOP"}
        </span>
        {spot.hint && <span className="font-mono">{spot.hint}</span>}
      </div>

      {requiresSize && (
        <div className="mt-6 w-full max-w-sm">
          <div className="grid grid-cols-3 gap-1.5">
            {[3, 4].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setRaiseSize(size)}
                disabled={answer !== null}
                className={cn(
                  "rounded-md border py-1.5 font-mono text-xs font-medium transition",
                  raiseSize === size
                    ? "border-amber-500 bg-amber-500 text-zinc-950"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
                )}
              >
                {size}bb
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRaiseSize(maximumRaise)}
              disabled={answer !== null}
              className={cn(
                "rounded-md border py-1.5 font-mono text-xs font-medium transition",
                raiseSize === maximumRaise
                  ? "border-amber-500 bg-amber-500 text-zinc-950"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
              )}
            >
              All-in
            </button>
          </div>
          <div className="mt-2 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
            <button
              type="button"
              aria-label="Decrease raise by one big blind"
              onClick={() => adjustRaise(-1)}
              disabled={answer !== null || raiseSize <= 2}
              className="flex h-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <input
              id="raise-size"
              aria-label="Raise size in big blinds"
              type="range"
              min="2"
              max={maximumRaise}
              step="1"
              value={raiseSize}
              disabled={answer !== null}
              onChange={(event) => setRaiseSize(Number(event.target.value))}
              className="h-2 w-full accent-amber-500"
            />
            <button
              type="button"
              aria-label="Increase raise by one big blind"
              onClick={() => adjustRaise(1)}
              disabled={answer !== null || raiseSize >= maximumRaise}
              className="flex h-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex w-full max-w-sm gap-2">
        {(["fold", "call", "raise"] as const).map((action) => (
          <button
            key={action}
            disabled={answer !== null}
            onClick={() => choose(action)}
            className={cn(
              "min-h-16 flex-1 rounded-xl border text-sm font-medium capitalize transition",
              action === "fold" && "border-rose-700 bg-rose-700 text-white hover:bg-rose-600",
              action === "call" && "border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800",
              action === "raise" && "border-amber-600 bg-amber-500 text-zinc-950 hover:bg-amber-400",
              answer === action && correct && "border-emerald-500 bg-emerald-500 text-white",
              answer === action && !correct && "border-rose-500 bg-rose-500 text-white",
              answer !== null && answer !== action && spot.expected === action && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {action === "raise" && spot.spot.scenario === "vs-4bet"
              ? "all-in"
              : action === "raise" && requiresSize
                ? <>Raise to<br /><span className="font-mono text-lg">{raiseSize}bb</span></>
                : action}
            {action !== "raise" && <span className="mt-1 block text-[10px] opacity-45">{action[0].toUpperCase()}</span>}
          </button>
        ))}
      </div>

      {answer !== null && !correct && (
        <div className="mt-5 max-w-md text-center">
          {showFamily && (
            <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {CONTEXTUAL_FAMILY_LABELS[spot.family]}
            </p>
          )}
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {spot.expected === "raise" && expectedRaiseSize !== null
              ? `raise to ${expectedRaiseSize}bb`
              : spot.expected === "raise"
                ? "all-in"
                : spot.expected}
          </p>
          {answer === "raise" && sizingCorrect === false && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Your size: {raiseSize}bb</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {contextualRuleLabel(spot)}
          </p>
          <button
            onClick={advance}
            className="mt-3 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Next → <span className="opacity-60">or press space</span>
          </button>
        </div>
      )}
    </div>
  );
}
