"use client";

import { useMemo, useState } from "react";
import { PreflopDrill } from "@/components/preflop-drill";
import { PreflopGrid } from "@/components/preflop-grid";
import { type ChartSet, type Position, nodeId } from "@/lib/poker/charts";
import { cn } from "@/lib/utils";

type Mode = "study" | "drill";

const ALL: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

/** Order a set of seats the way a table sits. */
function inTableOrder(seats: Iterable<Position>): Position[] {
  const present = new Set(seats);
  return ALL.filter((seat) => present.has(seat));
}

/** Seats the chart covers against a given opener, or when folded round. */
function heroSeatsFor(chartSet: ChartSet, villain: Position | null): Position[] {
  return inTableOrder(
    chartSet.nodes
      .filter((n) => n.key.villain === (villain ?? undefined))
      .map((n) => n.key.position),
  );
}

export function PreflopTrainer({ chartSet }: { chartSet: ChartSet }) {
  const [mode, setMode] = useState<Mode>("study");
  const [villain, setVillain] = useState<Position | null>(null);
  const [hero, setHero] = useState<Position>("BTN");

  const node = useMemo(
    () =>
      chartSet.nodes.find(
        (n) => n.key.position === hero && n.key.villain === (villain ?? undefined),
      ) ?? null,
    [chartSet, hero, villain],
  );

  /**
   * The spots this chart set actually holds, derived rather than listed.
   *
   * These were two hardcoded arrays until version 3 removed the facing-a-raise
   * nodes, and the picker went on cheerfully offering "CO opens" — a choice
   * that matched nothing and rendered an empty grid. A picker cannot offer a
   * spot the chart lacks if it reads the chart to build itself.
   */
  const villainOptions = useMemo(
    () =>
      inTableOrder(
        chartSet.nodes
          .map((n) => n.key.villain)
          .filter((seat): seat is Position => Boolean(seat)),
      ),
    [chartSet],
  );

  const heroOptions = useMemo(
    () => heroSeatsFor(chartSet, villain),
    [chartSet, villain],
  );

  function chooseVillain(next: Position | null) {
    setVillain(next);
    const options = heroSeatsFor(chartSet, next);
    if (options.length > 0 && !options.includes(hero)) {
      setHero(options[options.length - 1]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        {/* The whole row disappears when the set only covers unopened pots.
            One choice is not a choice. */}
        {villainOptions.length > 0 && (
          <Row label="Action before me">
            <Chip active={villain === null} onClick={() => chooseVillain(null)}>
              Folded to me
            </Chip>
            {villainOptions.map((p) => (
              <Chip
                key={p}
                active={villain === p}
                onClick={() => chooseVillain(p)}
              >
                {p} opens
              </Chip>
            ))}
          </Row>
        )}

        <Row label="My seat">
          {heroOptions.map((p) => (
            <Chip key={p} active={hero === p} onClick={() => setHero(p)}>
              {p}
            </Chip>
          ))}
        </Row>
      </div>

      {!node ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          This chart set does not cover that spot yet. The beginner set is the
          twenty nodes where the money actually is — opening, and facing a single
          open. Squeezes, 4-bets and blind-versus-blind come later.
        </p>
      ) : (
        <>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
            {(["study", "drill"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition",
                  mode === m
                    ? "bg-white shadow-sm dark:bg-zinc-800"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === "study" ? (
            <PreflopGrid node={node} />
          ) : (
            // Keyed on the node so switching spots resets the drill rather than
            // carrying answers across into a different chart. The same id is
            // the card's identity, which is why it doubles as the item key.
            <PreflopDrill
              key={nodeId(node.key)}
              node={node}
              itemKey={nodeId(node.key)}
            />
          )}
        </>
      )}

      <p className="border-t border-zinc-200 pt-4 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {chartSet.name}.
        </span>{" "}
        {chartSet.notes}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-32 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition",
        active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}
