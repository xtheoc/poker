"use client";

import {
  type ActionKind,
  type ChartNode,
  bestAction,
  freqOf,
  strategyFor,
} from "@/lib/poker/charts";
import { RANKS, combosOf } from "@/lib/poker/hands";
import { cn } from "@/lib/utils";

/**
 * The 13x13 hand matrix.
 *
 * The layout is the one every poker tool uses, and that consistency matters far
 * more than any improvement we could invent: pairs down the diagonal, suited
 * hands above it, offsuit below, ranks descending from the top left. Anyone who
 * has seen a range chart elsewhere can read this one without being taught it.
 */

const DESC = [...RANKS].reverse();

const ACTION_STYLES: Record<ActionKind, string> = {
  // Aggression reads warm, passivity cool, folding recedes. The fold colour is
  // deliberately low-contrast: most of the grid folds at most nodes, and if
  // folds shouted, the shape of the range would be impossible to see.
  raise: "bg-rose-500 text-white",
  allin: "bg-rose-700 text-white",
  call: "bg-emerald-600 text-white",
  fold: "bg-zinc-200 text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-600",
};

const ACTION_LABELS: Record<ActionKind, string> = {
  raise: "Raise",
  allin: "All-in",
  call: "Call",
  fold: "Fold",
};

function handAt(row: number, col: number): string {
  if (row === col) return `${DESC[row]}${DESC[col]}`;
  // Above the diagonal is suited, and the row holds the higher card there.
  if (row < col) return `${DESC[row]}${DESC[col]}s`;
  return `${DESC[col]}${DESC[row]}o`;
}

/** Share of all combinations at which the node takes a given action. */
function actionPercent(node: ChartNode, action: ActionKind): number {
  let combos = 0;
  for (let r = 0; r < DESC.length; r++) {
    for (let c = 0; c < DESC.length; c++) {
      const hand = handAt(r, c);
      combos += combosOf(hand) * freqOf(strategyFor(node, hand), action);
    }
  }
  return (combos / 1326) * 100;
}

export function PreflopGrid({
  node,
  highlight,
}: {
  node: ChartNode;
  /** A hand to ring, used to show the drill's current hand in context. */
  highlight?: string;
}) {
  const raise = actionPercent(node, "raise");
  const call = actionPercent(node, "call");
  const played = raise + call + actionPercent(node, "allin");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-13 gap-[2px] select-none">
        {DESC.map((_, row) =>
          DESC.map((__, col) => {
            const hand = handAt(row, col);
            const action = bestAction(strategyFor(node, hand));
            return (
              <div
                key={hand}
                title={`${hand} — ${ACTION_LABELS[action]}`}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-[3px]",
                  "text-[9px] sm:text-[11px] font-medium tabular-nums",
                  ACTION_STYLES[action],
                  highlight === hand &&
                    "ring-2 ring-sky-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950",
                )}
              >
                {hand}
              </div>
            );
          }),
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <Swatch className="bg-rose-500" label={`Raise ${raise.toFixed(1)}%`} />
        {call > 0 && (
          <Swatch className="bg-emerald-600" label={`Call ${call.toFixed(1)}%`} />
        )}
        <Swatch
          className="bg-zinc-200 dark:bg-zinc-800"
          label={`Fold ${(100 - played).toFixed(1)}%`}
        />
        <span className="ml-auto font-medium text-zinc-600 dark:text-zinc-300">
          Plays {played.toFixed(1)}% of hands
        </span>
      </div>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[2px]", className)} />
      {label}
    </span>
  );
}
