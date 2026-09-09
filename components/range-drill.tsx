"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ChartSet } from "@/lib/poker/charts";
import { type Hand, handGrid } from "@/lib/poker/hands";
import { describeSpot } from "@/lib/poker/quickfire";
import {
  type MarkAction,
  type QuizResult,
  gradeSelection,
} from "@/lib/poker/range-quiz";
import { cn } from "@/lib/utils";

/**
 * Draw the range from memory, seat by seat, against a clock.
 *
 * The quickfire drill asks about one hand at a time, which trains recognition.
 * This asks you to produce the whole shape, which is harder and closer to what
 * you actually carry to a table — where the question is never "is K9s a raise"
 * in isolation, but "is the hand I hold inside the shape I know".
 *
 * **A seat is not passed until it is perfect.** Not 95%, not "close enough":
 * the value of drawing a range is that its edges are exact, and the edges are
 * precisely where a near-miss lives. Getting it wrong clears the grid and
 * restarts that seat, so the correction has to be remembered rather than
 * patched — the same reason the reader makes you rewrite a summary instead of
 * editing the one you got marked.
 *
 * **The clock runs across the whole exercise, not per seat.** A per-seat timer
 * would reward rushing the small ranges; one clock over all of them rewards
 * knowing them.
 *
 * **Painted, not clicked one cell at a time.** A range is drawn in blocks — a
 * row of aces, the diagonal of pairs — and clicking ninety-one cells to say so
 * measures dexterity rather than knowledge. Hold the button down and sweep.
 * Left paints a raise, right paints a call, and a stroke that begins on a cell
 * already marked that way erases instead, so a mistake is undone the same way
 * it was made.
 */

/** Where the best completed run is kept. */
const BEST_KEY = "range-drill-best-ms";

const bestListeners = new Set<() => void>();

function subscribeBest(onChange: () => void): () => void {
  bestListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    bestListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readBest(): number {
  try {
    const stored = Number.parseInt(localStorage.getItem(BEST_KEY) ?? "", 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

/** The server has no storage, so it has no best. */
function serverBest(): number {
  return 0;
}

function writeBest(ms: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(ms));
  } catch {
    // Not remembering a time must not stop the exercise.
  }
  for (const listener of bestListeners) listener();
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const GRID = handGrid();

/**
 * A stroke in progress.
 *
 * `erase` is decided once, on the cell the stroke starts from, and then holds
 * for the whole sweep. Deciding it per cell would make a drag across a
 * half-marked row alternate on and off — the behaviour of a toggle, not of a
 * brush.
 */
interface Stroke {
  action: MarkAction;
  erase: boolean;
}

export function RangeDrill({ chartSet }: { chartSet: ChartSet }) {
  const seats = useMemo(
    () => chartSet.nodes.filter((node) => !node.key.villain),
    [chartSet],
  );

  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<Map<Hand, MarkAction>>(new Map());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [finishedIn, setFinishedIn] = useState<number | null>(null);
  /**
   * What a plain click paints.
   *
   * Raise, on a mouse, always — the right button is the other action and that
   * is what was asked for. It is a control at all because a touchscreen has no
   * second button, and two of these ranges cannot be completed without calling.
   * A drill that cannot be finished on the device you own is not a drill.
   */
  const [brush, setBrush] = useState<MarkAction>("raise");
  const best = useSyncExternalStore(subscribeBest, readBest, serverBest);

  const stroke = useRef<Stroke | null>(null);

  const node = seats[index];
  const running = startedAt !== null && finishedIn === null;

  // The one genuinely external thing on this screen: a clock that changes on
  // its own rather than because something was rendered.
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [running]);

  // A stroke ends wherever the button comes up, including outside the grid and
  // outside the window. Without this, a drag released off-target would leave
  // the brush down and paint on the next hover, which reads as broken rather
  // than as sticky.
  useEffect(() => {
    function end() {
      stroke.current = null;
    }
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const elapsed =
    finishedIn ?? (startedAt === null ? 0 : Math.max(0, now - startedAt));

  /** Apply the stroke in progress to one cell. */
  const paint = useCallback(
    (hand: Hand) => {
      const current = stroke.current;
      if (!current || result) return;

      setMarks((previous) => {
        // Nothing to do is genuinely nothing: returning the same map keeps a
        // sweep back across already-painted cells from re-rendering the grid
        // once per cell crossed.
        if (current.erase) {
          if (!previous.has(hand)) return previous;
          const next = new Map(previous);
          next.delete(hand);
          return next;
        }
        if (previous.get(hand) === current.action) return previous;
        const next = new Map(previous);
        next.set(hand, current.action);
        return next;
      });
    },
    [result],
  );

  /** Start a stroke, and the clock if this is the first mark of the run. */
  const begin = useCallback(
    (hand: Hand, action: MarkAction) => {
      if (result) return;
      if (startedAt === null) {
        // The clock starts on the first cell, not on arriving at the page.
        const began = Date.now();
        setStartedAt(began);
        setNow(began);
      }
      stroke.current = { action, erase: marks.get(hand) === action };
      paint(hand);
    },
    [marks, paint, result, startedAt],
  );

  const submit = useCallback(() => {
    if (!node || result) return;
    setResult(gradeSelection(node, marks));
  }, [marks, node, result]);

  const advance = useCallback(() => {
    if (!result) return;

    if (!result.perfect) {
      // Wrong: same seat, empty grid. See the header.
      setMarks(new Map());
      setResult(null);
      return;
    }

    setResult(null);
    setMarks(new Map());

    if (index + 1 < seats.length) {
      setIndex(index + 1);
      return;
    }

    const took = startedAt === null ? 0 : Date.now() - startedAt;
    setFinishedIn(took);
    if (best === 0 || took < best) writeBest(took);
  }, [best, index, result, seats.length, startedAt]);

  const restart = useCallback(() => {
    setIndex(0);
    setMarks(new Map());
    setResult(null);
    setStartedAt(null);
    setFinishedIn(null);
  }, []);

  if (finishedIn !== null) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <p className="text-5xl font-semibold tabular-nums">
          {clock(finishedIn)}
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          All {seats.length} ranges, drawn correctly.
        </p>
        {best > 0 && (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {finishedIn <= best ? "That is your best." : `Best ${clock(best)}.`}
          </p>
        )}
        <button
          onClick={restart}
          className="mt-8 w-full max-w-xs rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Again
        </button>
      </div>
    );
  }

  if (!node) return null;

  const marked = result !== null;
  const missed = new Set(result?.missed ?? []);
  const extra = new Set(result?.extra ?? []);
  const wrongAction = new Set(result?.wrongAction ?? []);
  const raises = [...marks.values()].filter((a) => a === "raise").length;
  const calls = marks.size - raises;

  // Two of these nodes are the button's, so the seat name alone would name the
  // same seat twice with different right answers. What separates them is what
  // happened before the action reached you.
  const { before } = describeSpot(node);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex w-full max-w-sm items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">{node.key.position}</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {index + 1} of {seats.length}
          </span>
        </div>
        <div className="text-right">
          <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            {clock(elapsed)}
          </span>
          {best > 0 && (
            <span className="ml-2 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
              best {clock(best)}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 w-full max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
        {marked
          ? result.perfect
            ? "Exactly right."
            : "Not yet — the grid clears and you draw it again."
          : `${before}. Drag to paint — left click raises, right click calls.`}
      </p>

      <div className="mt-4 w-full max-w-sm">
        <div
          className="grid touch-none grid-cols-13 gap-[2px] select-none"
          // Right-dragging must not raise the browser's menu mid-stroke.
          onContextMenu={(event) => event.preventDefault()}
          onPointerMove={(event) => {
            if (!stroke.current) return;
            // The cell under the pointer, found by hit test rather than by
            // per-cell enter handlers: a touch pointer is captured by whatever
            // it started on and never enters its neighbours, so enter handlers
            // would give a drag that works with a mouse and does nothing at all
            // with a finger.
            const under = document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest<HTMLElement>("[data-hand]");
            if (under?.dataset.hand) paint(under.dataset.hand as Hand);
          }}
        >
          {GRID.map((row) =>
            row.map((hand) => {
              const chosen = marks.get(hand);
              const right =
                marked && chosen && !extra.has(hand) && !wrongAction.has(hand);
              return (
                <button
                  key={hand}
                  data-hand={hand}
                  disabled={marked}
                  title={hand}
                  onPointerDown={(event) => {
                    // Stops a drag becoming a text selection or a native drag.
                    event.preventDefault();
                    begin(hand, event.button === 2 ? "call" : brush);
                  }}
                  onClick={(event) => {
                    // `detail === 0` means the keyboard, not the mouse. A
                    // pointer click has already been handled above, and
                    // handling it again would flip the cell straight back.
                    if (event.detail !== 0) return;
                    begin(hand, brush);
                    stroke.current = null;
                  }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-[3px]",
                    "text-[8px] font-medium tabular-nums transition-colors sm:text-[10px]",
                    // Before marking: how you played it, or nothing.
                    !marked &&
                      !chosen &&
                      "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800/70 dark:text-zinc-500 dark:hover:bg-zinc-700",
                    !marked &&
                      chosen === "raise" &&
                      "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
                    !marked && chosen === "call" && "bg-sky-600 text-white",
                    // After: right, right hand played the wrong way, wrongly
                    // added, or wrongly left out.
                    right && chosen === "raise" && "bg-emerald-600 text-white",
                    right && chosen === "call" && "bg-emerald-500/70 text-white",
                    marked &&
                      wrongAction.has(hand) &&
                      "bg-violet-500 text-white",
                    marked && extra.has(hand) && "bg-rose-500 text-white",
                    marked && missed.has(hand) && "bg-amber-400 text-zinc-900",
                    marked &&
                      !chosen &&
                      !missed.has(hand) &&
                      "bg-zinc-100 text-zinc-300 dark:bg-zinc-800/70 dark:text-zinc-600",
                  )}
                >
                  {hand}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {marked && !result.perfect && (
        <div className="mt-3 w-full max-w-sm space-y-1 text-xs">
          {result.extra.length > 0 && (
            <p className="text-rose-600 dark:text-rose-400">
              <span className="font-medium">{result.extra.length} too many</span>{" "}
              <span className="font-mono">{result.extra.join(", ")}</span>
            </p>
          )}
          {result.missed.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              <span className="font-medium">{result.missed.length} missing</span>{" "}
              <span className="font-mono">{result.missed.join(", ")}</span>
            </p>
          )}
          {result.wrongAction.length > 0 && (
            <p className="text-violet-600 dark:text-violet-400">
              <span className="font-medium">
                {result.wrongAction.length} played the wrong way
              </span>{" "}
              <span className="font-mono">
                {result.wrongAction
                  .map((hand) => `${hand} is a ${result.expected.get(hand)}`)
                  .join(", ")}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        {!marked ? (
          <>
            <button
              onClick={submit}
              className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Submit
            </button>
            <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
              {raises} raise · {calls} call
            </span>
          </>
        ) : (
          <button
            onClick={advance}
            className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            {result.perfect
              ? index + 1 < seats.length
                ? `Next — ${seats[index + 1].key.position}`
                : "Finish"
              : "Try again"}
          </button>
        )}
      </div>

      {/* The brush. Redundant with the mouse buttons, and the only way in on a
          touchscreen, so it sits below the grid rather than above it. */}
      {!marked && (
        <div className="mt-4 flex items-center gap-1">
          {(["raise", "call"] as const).map((action) => (
            <button
              key={action}
              onClick={() => setBrush(action)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs capitalize transition",
                action === brush
                  ? action === "raise"
                    ? "bg-zinc-900 font-medium text-white dark:bg-white dark:text-zinc-900"
                    : "bg-sky-600 font-medium text-white"
                  : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
