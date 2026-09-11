"use client";

import { useCallback, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ContextualPreflopDrill } from "@/components/contextual-preflop-drill";
import { CtmSizingDrill } from "@/components/ctm-sizing-drill";
import { FlopPlanDrill } from "@/components/flop-plan-drill";
import { PlayerDrill } from "@/components/player-drill";
import { RangeDrill } from "@/components/range-drill";
import type { HudRead } from "@/lib/hud/deal";
import type { ChartNode, ChartSet } from "@/lib/poker/charts";
import type { ContextualPreflopSpot } from "@/lib/strategies/ctm-contextual";
import type { CtmSizingSpot } from "@/lib/strategies/ctm-sizing";

export type CircuitDrillId =
  | "player-types"
  | "open-ranges"
  | "open-sizing"
  | "facing-open"
  | "squeeze"
  | "facing-3bet"
  | "facing-4bet"
  | "flop-plan";

type Result = { score: number; durationMs: number; answers: number };

const META: Record<CircuitDrillId, { label: string; detail: string }> = {
  "player-types": { label: "Read the player", detail: "HUD pattern" },
  "open-ranges": { label: "Opening ranges", detail: "Draw the range" },
  "open-sizing": { label: "Open sizing", detail: "Choose the size" },
  "facing-open": { label: "Facing an open", detail: "3-bet, call or fold" },
  squeeze: { label: "Squeeze", detail: "Open plus caller" },
  "facing-3bet": { label: "Facing a three-bet", detail: "4-bet, call or fold" },
  "facing-4bet": { label: "Facing a four-bet", detail: "Continue or fold" },
  "flop-plan": { label: "Flop plan", detail: "Plan before betting" },
};

/**
 * A workout is intentionally separate from mastery. It lets the learner run
 * everything they have opened without manufacturing course evidence or a
 * network save after each answer. The course drills remain the source of
 * unlocks; this is the repetition layer.
 */
export function StrategyPracticeCircuit({
  chartSet,
  drills,
  initialHud,
  rangeNodes,
  initialSizing,
  contextual,
}: {
  chartSet: ChartSet;
  drills: readonly CircuitDrillId[];
  initialHud: HudRead;
  rangeNodes: readonly ChartNode[];
  initialSizing: readonly CtmSizingSpot[];
  contextual: Partial<Record<CircuitDrillId, readonly ContextualPreflopSpot[]>>;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Partial<Record<CircuitDrillId, Result>>>({});
  const [run, setRun] = useState(0);
  const current = drills[index];
  const result = current ? results[current] : undefined;

  const record = useCallback((value: Result) => {
    if (!current) return;
    setResults((previous) => previous[current] ? previous : { ...previous, [current]: value });
  }, [current]);

  const next = useCallback(() => {
    setIndex((value) => value + 1);
    setRun((value) => value + 1);
  }, []);

  const restart = useCallback(() => {
    setIndex(0);
    setResults({});
    setRun((value) => value + 1);
  }, []);

  if (!current) {
    return (
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="size-5" aria-hidden="true" /></span>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight">Workout complete</h2>
        <div className="mt-7 divide-y divide-zinc-200 border-y border-zinc-200 text-left dark:divide-zinc-800 dark:border-zinc-800">
          {drills.map((drill) => (
            <div key={drill} className="flex items-center justify-between py-3 text-sm">
              <span>{META[drill].label}</span>
              <span className="font-mono text-xs text-zinc-500">{results[drill]?.score ?? 0}%</span>
            </div>
          ))}
        </div>
        <button onClick={restart} className="mt-8 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Again</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto mb-8 flex max-w-xl items-end justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">{index < 7 ? "Pre-flop exercise" : "Full workout"}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{META[current].label}</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{META[current].detail}</p>
        </div>
        <span className="font-mono text-xs text-zinc-400">{index + 1} / {drills.length}</span>
      </div>

      <div key={`${current}-${run}`}>
        {current === "player-types" && <PlayerDrill initial={initialHud} masteryStreak={5} onMastery={record} />}
        {current === "open-ranges" && <RangeDrill chartSet={chartSet} nodes={rangeNodes} onMastery={record} />}
        {current === "open-sizing" && <CtmSizingDrill initialSpots={initialSizing} onComplete={record} />}
        {["facing-open", "squeeze", "facing-3bet", "facing-4bet"].includes(current) && contextual[current] && (
          <ContextualPreflopDrill chartSet={chartSet} initialSpots={contextual[current]} completionStreak={5} onMastery={record} />
        )}
        {current === "flop-plan" && <FlopPlanDrill onComplete={record} />}
      </div>

      {result && (
        <div className="mx-auto mt-8 flex max-w-xl items-center justify-between border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <span className="text-sm text-zinc-500">{META[current].label}: <span className="font-medium text-zinc-900 dark:text-white">{result.score}%</span></span>
          <button onClick={next} className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4">{index + 1 === drills.length ? "Finish" : "Next drill"}<ArrowRight className="size-4" aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}
