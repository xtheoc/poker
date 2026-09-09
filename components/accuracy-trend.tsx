import { cn } from "@/lib/utils";

/**
 * Preflop accuracy over time.
 *
 * The question this app existed to answer and could not: am I getting better?
 * Accuracy per sitting was computed and shown one session at a time, so
 * comparing meant opening sessions and remembering.
 *
 * Bars rather than a line, deliberately. A line implies a continuous quantity
 * sampled at intervals; these are discrete sittings of wildly different size,
 * and joining them would invent a trajectory through the gaps that nothing
 * measured. Bars say "here are the evenings" and let you see the shape without
 * asserting anything between them.
 *
 * The axis starts at 50 rather than 0. Nothing here ever sits much below half —
 * the chart folds most hands and so will you — so a zero baseline would squeeze
 * every real difference into the top of the frame.
 */

export interface TrendBar {
  at: string;
  accuracy: number;
  charted: number;
}

/** Where the axis begins. Below this is not a range anyone actually occupies. */
const FLOOR = 50;

/** Sittings shown. Beyond this the bars are too thin to read. */
const MAX_BARS = 24;

/** Enough sittings to be a shape rather than a coincidence. */
const MIN_FOR_TREND = 3;

export function AccuracyTrend({
  points,
  overall,
  hands,
}: {
  points: TrendBar[];
  /** Accuracy across every graded decision. */
  overall: { accuracy: number; charted: number; mistakes: number };
  /**
   * Every hand imported.
   *
   * Shown beside the accuracy because the two answer different questions, and
   * the second silently qualifies the first: 94% means one thing over ninety
   * hands and quite another over nine thousand. It is also simply the number
   * you want when checking whether an import worked.
   */
  hands: number;
}) {
  const recent = points.slice(-MAX_BARS);
  const showTrend = points.length >= MIN_FOR_TREND;

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "text-4xl font-semibold tabular-nums",
            overall.accuracy >= 90
              ? "text-emerald-600 dark:text-emerald-400"
              : overall.accuracy >= 75
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400",
          )}
        >
          {overall.accuracy.toFixed(0)}%
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          preflop accuracy ·{" "}
          <span className="tabular-nums">
            {overall.charted - overall.mistakes}
          </span>{" "}
          of <span className="tabular-nums">{overall.charted}</span> charted
          spots
        </span>

        <span className="ml-auto text-right">
          <span className="block text-2xl font-semibold tabular-nums">
            {hands.toLocaleString()}
          </span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            hands
          </span>
        </span>
      </div>

      {showTrend && (
        <>
          <div className="mt-5 flex h-20 items-end gap-1">
            {recent.map((point) => {
              const height = Math.min(
                100,
                Math.max(4, ((point.accuracy - FLOOR) / (100 - FLOOR)) * 100),
              );
              return (
                <div
                  key={point.at}
                  title={`${new Date(point.at).toLocaleDateString()} — ${point.accuracy.toFixed(0)}% of ${point.charted}`}
                  className={cn(
                    "flex-1 rounded-t-sm",
                    point.accuracy >= 90
                      ? "bg-emerald-500/70"
                      : point.accuracy >= 75
                        ? "bg-amber-500/70"
                        : "bg-rose-500/70",
                  )}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400 dark:text-zinc-600">
            <span>
              {new Date(recent[0].at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}
            </span>
            <span>one bar per session · axis from {FLOOR}%</span>
            <span>
              {new Date(recent[recent.length - 1].at).toLocaleDateString(
                undefined,
                { day: "numeric", month: "short" },
              )}
            </span>
          </div>
        </>
      )}

      {!showTrend && points.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          A trend needs a few more sessions before it means anything.
        </p>
      )}
    </section>
  );
}
