"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  /** General practice mixes branches, so identify the branch after each spot. */
  showFamily?: boolean;
  /** A raise in free practice includes its source-derived size. */
  sizeRaises?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answer, setAnswer] = useState<ActionKind | null>(null);
  const [pendingRaise, setPendingRaise] = useState(false);
  const [raiseSize, setRaiseSize] = useState(6);
  const [sizingCorrect, setSizingCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef<number | null>(null);
  const answers = useRef(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spot = initialSpots[index];

  const advance = useCallback(() => {
    setAnswer(null);
    setPendingRaise(false);
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
    if (chosen === "raise" && requiresSize && spot?.expected === "raise") {
      setPendingRaise(true);
      setRaiseSize(6);
      return;
    }
    grade(chosen);
  }, [grade, requiresSize, spot?.expected]);

  const submitRaise = useCallback(() => {
    if (!pendingRaise) return;
    setPendingRaise(false);
    grade("raise", raiseSize);
  }, [grade, pendingRaise, raiseSize]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (finished) return;
      if (pendingRaise) {
        if (["enter", " "].includes(event.key.toLowerCase())) {
          event.preventDefault();
          submitRaise();
        }
        return;
      }
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
  }, [advance, answer, choose, finished, pendingRaise, spot?.expected, submitRaise]);

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
      {showFamily && (
        <p className="mt-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {CONTEXTUAL_FAMILY_LABELS[spot.family]}
        </p>
      )}
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

      <div className="mt-6 flex gap-2">
        {(["fold", "call", "raise"] as const).map((action) => (
          <button
            key={action}
            disabled={answer !== null || pendingRaise}
            onClick={() => choose(action)}
            className={cn(
              "w-28 rounded-xl border py-4 text-sm font-medium capitalize transition",
              "border-zinc-300 dark:border-zinc-700",
              answer === null && "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              answer === action && correct && "border-emerald-500 bg-emerald-500 text-white",
              answer === action && !correct && "border-rose-500 bg-rose-500 text-white",
              answer !== null && answer !== action && spot.expected === action && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {action === "raise" && spot.spot.scenario === "vs-4bet" ? "all-in" : action}
            <span className="mt-1 block text-[10px] opacity-40">{action[0].toUpperCase()}</span>
          </button>
        ))}
      </div>

      {pendingRaise && (
        <div className="mt-6 w-full max-w-sm border-y border-zinc-200 py-5 dark:border-zinc-800">
          <div className="flex items-baseline justify-between">
            <label htmlFor="raise-size" className="text-sm font-medium">Raise to</label>
            <output htmlFor="raise-size" className="font-mono text-lg font-semibold tabular-nums">{raiseSize}bb</output>
          </div>
          <input
            id="raise-size"
            type="range"
            min="2"
            max="25"
            step="0.5"
            value={raiseSize}
            onChange={(event) => setRaiseSize(Number(event.target.value))}
            className="mt-5 w-full accent-amber-500"
          />
          <button
            onClick={submitRaise}
            className="mt-5 w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Confirm {raiseSize}bb
          </button>
        </div>
      )}

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
