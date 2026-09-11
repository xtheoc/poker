"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ContextualPreflopDrill } from "@/components/contextual-preflop-drill";
import { CtmSizingDrill } from "@/components/ctm-sizing-drill";
import { FlopPlanDrill } from "@/components/flop-plan-drill";
import { PlayerDrill } from "@/components/player-drill";
import { RangeDrill } from "@/components/range-drill";
import type { HudRead } from "@/lib/hud/deal";
import type { ChartNode, ChartSet } from "@/lib/poker/charts";
import type { CtmSizingSpot } from "@/lib/strategies/ctm-sizing";
import type { ContextualPreflopSpot } from "@/lib/strategies/ctm-contextual";

type DrillResult = {
  score: number;
  durationMs: number;
  answers: number;
};

const ACTION_DRILLS = new Set([
  "facing-open",
  "squeeze",
  "facing-3bet",
  "facing-4bet",
]);

export function StrategyPreflopDrill({
  strategyId,
  lessonId,
  drillId,
  chartSet,
  initialHud,
  initialContextual,
  rangeNodes,
  initialSizing,
  masteryAnswers,
}: {
  strategyId: string;
  lessonId: string;
  drillId: string;
  chartSet: ChartSet;
  initialHud?: HudRead;
  initialContextual?: readonly ContextualPreflopSpot[];
  rangeNodes?: readonly ChartNode[];
  initialSizing?: readonly CtmSizingSpot[];
  /** Clean streak length for decision exercises. */
  masteryAnswers?: number;
}) {
  const [state, setState] = useState<
    "idle" | "saving" | "mastered" | "retry" | "failed"
  >("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const save = useCallback(
    async (result: DrillResult) => {
      setState("saving");
      setDetail(null);

      try {
        const response = await fetch(`/api/strategies/${strategyId}/mastery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, drillId, ...result }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          mastered?: boolean;
        } | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Could not save this run.");
        }

        const mastered = body?.mastered === true;
        setState(mastered ? "mastered" : "retry");
        setDetail(
          mastered
            ? "Lesson mastered. The next subject is open."
            : "Run saved. Only a clean run counts toward the course.",
        );
      } catch (error) {
        setState("failed");
        setDetail(
          error instanceof Error ? error.message : "Could not save this run.",
        );
      }
    },
    [drillId, lessonId, strategyId],
  );

  if (state === "mastered") {
    return (
      <div className="border-y border-zinc-200 py-12 text-center dark:border-zinc-800">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-3xl font-semibold tracking-tight">Mastered</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {detail}
        </p>
        <Link
          href={`/strategies/${strategyId}/learn`}
          className="mt-7 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
        >
          Continue learning
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <>
      {drillId === "player-types" && initialHud && (
        <PlayerDrill initial={initialHud} masteryStreak={masteryAnswers ?? 10} onMastery={save} />
      )}
      {drillId === "open-ranges" && rangeNodes && (
        <RangeDrill chartSet={chartSet} nodes={rangeNodes} onMastery={save} />
      )}
      {drillId === "open-sizing" && initialSizing && (
        <CtmSizingDrill initialSpots={initialSizing} onComplete={save} />
      )}
      {ACTION_DRILLS.has(drillId) && initialContextual && (
        <ContextualPreflopDrill
          chartSet={chartSet}
          initialSpots={initialContextual}
          completionStreak={masteryAnswers ?? 10}
          onMastery={save}
        />
      )}
      {drillId === "flop-plan" && <FlopPlanDrill onComplete={save} />}
      {(state === "saving" || state === "retry" || state === "failed") && (
        <p
          className={`mt-8 text-center text-sm ${
            state === "failed"
              ? "text-rose-600 dark:text-rose-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {state === "saving" ? "Saving..." : detail}
        </p>
      )}
    </>
  );
}
