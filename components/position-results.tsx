import {
  POSITION_RESULT_THRESHOLD,
  type PositionResult,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";

/**
 * Where the money goes, seat by seat.
 *
 * The question this answers — "which seats am I losing from" — is the right one
 * to ask, and the obvious way to answer it is dishonest. A per-seat win rate is
 * the slowest-converging number in poker: it is driven by rare large pots
 * rather than frequent small decisions, and splitting a sample six ways makes
 * each seat six times slower still. Rendering "-14bb/100 from the SB" in large
 * red type after ninety hands would be a statement about variance dressed as a
 * diagnosis, and acting on it — avoiding a seat you are in fact fine at — costs
 * real money.
 *
 * So each row carries both numbers. **The money is the record**, marked as
 * provisional until the sample is large enough to read. **The accuracy is the
 * diagnosis**, and needs no gate at all, because every charted decision from
 * that seat was either inside the range or outside it. If you really are
 * playing a seat badly, accuracy shows it from the first session — which is the
 * whole reason it sits beside the money rather than on another screen.
 *
 * A server component: nothing here is interactive.
 */
export function PositionResults({ results }: { results: PositionResult[] }) {
  if (results.length === 0) return null;

  // The worst seat sets the scale, so bars are comparable to each other rather
  // than to an absolute that would make everything look tiny at this volume.
  const widest = Math.max(...results.map((r) => Math.abs(r.netBb)), 1);
  const anyReliable = results.some((r) => r.reliable);

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">By seat</h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          worst first
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {anyReliable
          ? "Money won and lost from each seat, and how often you followed the chart there."
          : `Money by seat stays mostly variance until roughly ${POSITION_RESULT_THRESHOLD.toLocaleString()} hands from that seat — read it as a record, not a verdict. The accuracy beside it is solid now.`}
      </p>

      <ul className="space-y-1">
        {results.map((result) => (
          <Row key={result.position} result={result} widest={widest} />
        ))}
      </ul>
    </section>
  );
}

function Row({ result, widest }: { result: PositionResult; widest: number }) {
  const share = (Math.abs(result.netBb) / widest) * 100;
  const losing = result.netBb < 0;

  return (
    <li className="flex items-center gap-3 py-1">
      <span className="w-9 text-xs font-semibold tabular-nums">
        {result.position}
      </span>

      {/* Bars grow from a centre line, so winning and losing seats are
          distinguishable before any number is read. */}
      <span className="relative flex h-2 flex-1 items-center">
        <span className="absolute left-1/2 h-full w-px bg-zinc-200 dark:bg-zinc-800" />
        <span
          className={cn(
            "absolute h-2 rounded-sm",
            losing ? "right-1/2 bg-rose-500/70" : "left-1/2 bg-emerald-500/70",
            // A provisional number is drawn faintly. The bar must not look more
            // certain than the caption above it says it is.
            !result.reliable && "opacity-50",
          )}
          style={{ width: `${share / 2}%` }}
        />
      </span>

      <span
        className={cn(
          "w-16 text-right text-xs tabular-nums",
          losing
            ? "text-rose-600 dark:text-rose-400"
            : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {result.netBb > 0 ? "+" : ""}
        {result.netBb.toFixed(1)}bb
      </span>

      <span className="w-20 text-right text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
        {result.hands} hands
      </span>

      <span
        className={cn(
          "w-10 text-right text-xs tabular-nums",
          result.charted === 0
            ? "text-zinc-300 dark:text-zinc-700"
            : result.accuracy >= 90
              ? "text-emerald-600 dark:text-emerald-400"
              : result.accuracy >= 75
                ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400",
        )}
        title={
          result.charted === 0
            ? "No charted decisions from this seat yet"
            : `${result.charted - result.mistakes} of ${result.charted} charted decisions matched`
        }
      >
        {result.charted === 0 ? "—" : `${result.accuracy.toFixed(0)}%`}
      </span>
    </li>
  );
}
