"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PokerTable } from "@/components/poker-table";
import { PreflopGrid } from "@/components/preflop-grid";
import {
  type ActionKind,
  type ChartSet,
  limpersFor,
  offeredActions,
  wagersFor,
} from "@/lib/poker/charts";
import { type ActionGrade, gradeAction } from "@/lib/poker/grading";
import { type LeakTarget, cycleLeakSpots } from "@/lib/poker/leak-drill";
import {
  type QuickfireSpot,
  dealSession,
  describeSpot,
} from "@/lib/poker/quickfire";
import { cn } from "@/lib/utils";

/**
 * The drill, as one continuous game.
 *
 * It used to run in fixed batches of twenty and end with a score out of twenty.
 * That framing was wrong for what this is: you do not sit down to complete a
 * run, you sit down to see how far you can get, and a counter that resets every
 * twenty hands throws away the only number worth coming back for. So there is
 * one counter — the streak — and it ends when you get one wrong, not when the
 * batch runs out.
 *
 * **The chart is here, not on another page.** It was a link, and following it
 * unmounted the drill and lost the streak, which meant the honest move (look it
 * up when unsure) was punished harder than guessing. Now it opens in place.
 *
 * **Looking costs the hand, not the streak.** Open the chart and the spot stops
 * counting: you neither advance nor go back to zero. That is the right price.
 * Free lookups make the streak meaningless, and losing the streak for checking
 * teaches you to guess — the exact habit that costs money at a table. A peeked
 * answer is also withheld from the scheduler, because a card answered with the
 * answer in front of you says nothing about whether you know it, and feeding
 * that to FSRS would schedule it as though you did.
 */

/** Spots dealt at a time. */
const BATCH = 20;

/**
 * How long a correct answer stays up before the next spot.
 *
 * There is no matching constant for a wrong one. Being wrong is the moment
 * worth looking at, so it waits for a key rather than for a clock.
 */
const FEEDBACK_MS = 700;

/**
 * Answers between saves.
 *
 * A game that never finishes has no natural moment to save at, and closing the
 * tab must not throw the last twenty minutes away. Ten is often enough to lose
 * almost nothing and rare enough not to be chatty.
 */
const SAVE_EVERY = 10;

/**
 * Where the best streak lives between visits.
 *
 * A timed sprint lived here briefly and is gone again at the reader's request.
 * The case for the clock was that a streak rewards slowing down — you can hold
 * one indefinitely at five seconds a hand. True, and not the thing that was
 * wrong: a clock makes every sitting a race against a timer rather than against
 * a mistake, and the mistake is the part worth studying. The streak has its own
 * answer to dawdling, which is that it is unbounded — beating your best
 * eventually takes speed whether or not anything is counting down.
 *
 * A new key rather than reusing `drill-best-30`. The two numbers mean different
 * things — "right in thirty seconds" against "right in a row" — and showing one
 * under the other's label would hand you a best you never set.
 */
const BEST_KEY = "drill-best-streak";

/**
 * The best streak, read from and written to browser storage.
 *
 * An external store rather than state loaded in an effect. Two reasons, and
 * both are real rather than ceremonial: loading it in an effect means a render
 * with the wrong number followed immediately by another, and reading storage
 * during render instead would make the server say 0 while the browser says 14,
 * which is a hydration mismatch. `useSyncExternalStore` is built for exactly
 * this — a value that lives outside React and can change underneath it.
 *
 * Every access is wrapped: private windows, cleared site data and browsers set
 * to block storage all throw here, and a drill that will not start because it
 * cannot remember a number would be a poor trade.
 */
const bestListeners = new Set<() => void>();

function subscribeBest(onChange: () => void): () => void {
  bestListeners.add(onChange);
  // Another tab counts too. Beating your best in one window and not seeing it
  // in the other would look like the number had been lost.
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

function writeBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Not remembering is survivable; failing to record it must not stop play.
  }
  for (const listener of bestListeners) listener();
}

interface Answer {
  spot: QuickfireSpot;
  chosen: ActionKind;
  expected: ActionKind;
  grade: ActionGrade;
  score: number;
  strategyFreq: number;
  evLossBb?: number;
  durationMs: number;
  /** The chart was open when this was answered. */
  peeked: boolean;
}

type SaveState = "idle" | "saved" | "signed-out" | "failed";

function isRight(answer: Answer): boolean {
  return answer.grade === "best" || answer.grade === "correct";
}

export function QuickfireDrill({
  chartSet,
  initialSpots,
  signedIn,
  targets,
}: {
  chartSet: ChartSet;
  /**
   * The first batch, dealt on the server.
   *
   * Dealing is random, and random is impure — doing it while rendering makes
   * the component's output depend on when it ran, which React is right to
   * object to. Every later batch is dealt from an event handler, where
   * impurity is perfectly fine because a click is not a render.
   */
  initialSpots: QuickfireSpot[];
  signedIn: boolean;
  /**
   * Leaks to cycle through, when this is the "your hands" drill.
   *
   * Passed as data rather than as a dealt list so the browser can deal the next
   * batch itself. Absent means random practice over the whole tree.
   */
  targets?: LeakTarget[];
}) {
  const [spots, setSpots] = useState<QuickfireSpot[]>(initialSpots);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<Answer | null>(null);
  const [streak, setStreak] = useState(0);
  const [peeked, setPeeked] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const best = useSyncExternalStore(subscribeBest, readBest, serverBest);

  // Set from an effect rather than at construction: reading the clock during
  // render is impure in the same way dealing is, and the value is only needed
  // once a spot is actually on screen.
  const startedAt = useRef(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Answers not yet sent. A ref, so a save never races a re-render. */
  const pending = useRef<Answer[]>([]);

  const spot = spots[index];

  const deal = useCallback(
    (count: number, offset: number) =>
      targets && targets.length > 0
        ? cycleLeakSpots(chartSet, targets, count, { offset })
        : dealSession(chartSet, count),
    [chartSet, targets],
  );

  /**
   * Send everything not yet saved.
   *
   * Grouped by node, because each node is its own card and must be rated only
   * on the hands belonging to it — a card must not be marked down for a mistake
   * made at a different spot.
   */
  const flush = useCallback(async () => {
    if (pending.current.length === 0) return;
    // Peeked answers never reach the scheduler. See the module header.
    const batch = pending.current.filter((a) => !a.peeked);
    pending.current = [];
    if (batch.length === 0) return;
    if (!signedIn) {
      setSaveState("signed-out");
      return;
    }

    const byNode = new Map<string, Answer[]>();
    for (const a of batch) {
      const list = byNode.get(a.spot.itemKey);
      if (list) list.push(a);
      else byNode.set(a.spot.itemKey, [a]);
    }

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviews: [...byNode].map(([itemKey, list]) => ({
            itemKey,
            hands: list.map((a) => ({
              hand: a.spot.hand,
              chosenAction: a.chosen,
              expectedAction: a.expected,
              grade: a.grade,
              score: a.score,
              strategyFreq: a.strategyFreq,
              evLossBb: a.evLossBb,
              rngRoll: a.spot.roll,
              durationMs: a.durationMs,
            })),
          })),
        }),
      });

      if (response.status === 401) setSaveState("signed-out");
      else if (response.ok) setSaveState("saved");
      else setSaveState("failed");
    } catch {
      setSaveState("failed");
    }
  }, [signedIn]);

  const restart = useCallback(() => {
    setSpots(deal(BATCH, 0));
    setIndex(0);
    setAnswers([]);
    setCurrent(null);
    setStreak(0);
    setPeeked(false);
    setChartOpen(false);
    setStopped(false);
    setSaveState("idle");
    startedAt.current = Date.now();
  }, [deal]);

  const advance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);

    // Dismissing a wrong answer is what ends the run. The two are one gesture
    // on purpose: the correction has been sitting on screen waiting to be read,
    // and you decide when you have read it.
    if (current && !current.peeked && !isRight(current)) {
      setCurrent(null);
      setStopped(true);
      void flush();
      return;
    }

    setCurrent(null);
    setPeeked(false);
    setChartOpen(false);
    setIndex((i) => i + 1);
    startedAt.current = Date.now();
  }, [current, flush]);

  const stop = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setCurrent(null);
    setStopped(true);
    // Walking away with a streak still standing still earns the streak.
    if (streak > best) writeBest(streak);
    void flush();
  }, [best, flush, streak]);

  /** Open the chart, and mark this spot as not counting. */
  const peek = useCallback(() => {
    setChartOpen((open) => !open);
    setPeeked(true);
  }, []);

  const answer = useCallback(
    (action: ActionKind) => {
      if (!spot || current) return;

      const graded = gradeAction(spot.strategy, action, { roll: spot.roll });
      const result: Answer = {
        spot,
        chosen: action,
        expected: graded.expected,
        grade: graded.grade,
        score: graded.score,
        strategyFreq: graded.freq,
        evLossBb: graded.evLossBb,
        durationMs: Date.now() - startedAt.current,
        peeked,
      };

      setCurrent(result);
      setAnswers((prev) => [...prev, result]);
      pending.current.push(result);

      // Keep the deck topped up before it runs out, so the drill never stalls
      // between spots — the whole point is that it moves.
      if (index >= spots.length - 3) {
        const more = deal(BATCH, spots.length);
        if (more.length > 0) setSpots((prev) => [...prev, ...more]);
      }

      if (pending.current.length >= SAVE_EVERY) void flush();

      // A peeked spot neither extends the streak nor ends it: the chart was
      // open, so the answer says nothing either way. That is the whole price of
      // looking — the hand simply does not count.
      if (peeked) return;

      if (isRight(result)) {
        setStreak((n) => n + 1);
        // A right answer rolls on by itself; a wrong one waits for you.
        advanceTimer.current = setTimeout(advance, FEEDBACK_MS);
        return;
      }

      // Wrong, and the run is over — but not yet on screen. The correction sits
      // there until you press a key, because the moment you were wrong is the
      // only moment in the drill that teaches anything, and ending the run over
      // the top of it would throw that away to show you a score.
      if (streak > best) writeBest(streak);
    },
    [
      advance,
      best,
      current,
      deal,
      flush,
      index,
      peeked,
      spot,
      spots.length,
      streak,
    ],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (stopped) return;
      const key = event.key.toLowerCase();

      // During feedback any answer key skips ahead — a fast player should never
      // be held up by an animation they have already read.
      if (current) {
        if (["f", "c", "r", " ", "enter"].includes(key)) {
          event.preventDefault();
          advance();
        }
        return;
      }

      if (key === "h" || key === "?") {
        event.preventDefault();
        peek();
        return;
      }

      const map: Record<string, ActionKind> = {
        f: "fold",
        c: "call",
        r: "raise",
      };
      const chosen = map[key];
      if (!chosen) return;
      // Only keys for actions actually on screen. Ignoring a key whose button
      // is visible would be the same bug in a different place.
      if (!spot || !offeredActions(spot.node).includes(chosen)) return;
      event.preventDefault();
      answer(chosen);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, answer, current, peek, spot, stopped]);

  // Start the clock whenever a new spot appears. A ref, so this costs no render.
  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // Save whatever is outstanding when the drill is left. Best effort: a tab
  // closed mid-request loses at most the last few answers, which is why the
  // periodic flush above exists rather than relying on this.
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  if (stopped) {
    return (
      <Review
        answers={answers}
        best={best}
        streak={streak}
        onRestart={restart}
        saveState={signedIn ? saveState : "signed-out"}
      />
    );
  }
  if (!spot) return null;

  // Read off the node, never guessed from its shape. See `offeredActions`.
  const options = offeredActions(spot.node);

  return (
    <div className="flex w-full flex-col items-center">
      <Streak count={streak} best={best} peeked={peeked} />

      <div className="mt-4 w-full">
        <PokerTable
          position={spot.node.key.position}
          villain={spot.node.key.villain}
          limpers={limpersFor(spot.node)}
          wagers={wagersFor(spot.node, chartSet)}
          cards={spot.cards}
        />
      </div>

      {spot.roll !== undefined && (
        <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
          die {spot.roll}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        {options.map((action) => (
          <button
            key={action}
            onClick={() => answer(action)}
            className={cn(
              "w-28 rounded-xl border py-4 text-sm font-medium capitalize transition",
              "border-zinc-300 dark:border-zinc-700",
              !current && "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              current?.chosen === action &&
                (isRight(current)
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-rose-500 bg-rose-500 text-white"),
              current &&
                current.chosen !== action &&
                current.expected === action &&
                "border-emerald-500 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {action}
            <span className="mt-1 block text-[10px] opacity-40">
              {action[0].toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      {/* Only when wrong. A right answer is already leaving, and telling you
          the right answer you just gave is noise. */}
      {current && !isRight(current) && (
        <div className="mt-5 text-center">
          <p className="text-sm">
            <span className="font-mono font-semibold">{spot.hand}</span>{" "}
            <span className="text-zinc-500 dark:text-zinc-400">
              from the {spot.node.key.position} —
            </span>{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {current.expected}
            </span>
          </p>
          {/* Not "Next": a wrong answer ends the run, and a button that says
              otherwise would make the streak look like it had been lost to a
              bug rather than to this hand. */}
          <button
            onClick={advance}
            className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {current.peeked ? "Next" : "That ends the streak"} →{" "}
            <span className="opacity-60">or press space</span>
          </button>
        </div>
      )}

      <button
        onClick={peek}
        className={cn(
          "mt-5 text-xs transition",
          chartOpen
            ? "text-zinc-600 dark:text-zinc-300"
            : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300",
        )}
      >
        {chartOpen ? "Hide the range" : "Show the range · this one won't count"}
      </button>

      {chartOpen && (
        <div className="mt-4 w-full max-w-sm rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <PreflopGrid node={spot.node} highlight={spot.hand} />
        </div>
      )}

      {answers.length > 0 && (
        <button
          onClick={stop}
          className="mt-10 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Done
        </button>
      )}
    </div>
  );
}

/**
 * How many in a row, and the best you have managed.
 *
 * One number, large, because there is only one thing being improved. A 30s/60s
 * sprint clock lived here for a while and has been taken back out — the reason
 * is on `BEST_KEY`.
 */
function Streak({
  count,
  best,
  peeked,
}: {
  count: number;
  best: number;
  /** The chart is open, so this hand will neither extend nor end the run. */
  peeked: boolean;
}) {
  return (
    <div className="flex w-full max-w-sm items-baseline justify-between">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-4xl font-semibold tabular-nums transition-colors",
            count > 0
              ? "text-zinc-900 dark:text-zinc-50"
              : "text-zinc-300 dark:text-zinc-700",
          )}
        >
          {count}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {peeked ? "not counting" : "in a row"}
        </span>
      </div>

      {best > 0 && (
        <span
          className={cn(
            "text-xs tabular-nums transition-colors",
            // Passing your best mid-run is the moment worth noticing, the way
            // the last five seconds were on the clock this replaced.
            count > best
              ? "font-medium text-emerald-600 dark:text-emerald-400"
              : "text-zinc-400 dark:text-zinc-500",
          )}
        >
          {count > best ? "new best" : `best ${best}`}
        </span>
      )}
    </div>
  );
}

const SAVE_COPY: Record<SaveState, string> = {
  idle: "Saving…",
  saved: "Saved to your queue.",
  "signed-out": "Not saved — sign in to have these scheduled.",
  failed: "Could not save that run.",
};

/**
 * The end of a sitting, where explanations finally belong.
 *
 * Mistakes only. A list of every result is a wall to scroll past; the ones you
 * got wrong are the session.
 */
function Review({
  answers,
  best,
  streak,
  onRestart,
  saveState,
}: {
  answers: Answer[];
  best: number;
  /** The run's final streak — the score, and the only number that carries. */
  streak: number;
  onRestart: () => void;
  saveState: SaveState;
}) {
  const wrong = answers.filter((a) => !isRight(a));
  const peeked = answers.filter((a) => a.peeked).length;

  return (
    <div className="w-full">
      <div className="text-center">
        <p className="text-5xl font-semibold tabular-nums">{streak}</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          in a row · {answers.length}{" "}
          {answers.length === 1 ? "hand" : "hands"} played
          {peeked > 0 && ` · ${peeked} looked up`}
        </p>
        {best > 0 && (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {streak >= best ? "That is your best." : `Best ${best}.`}
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          {saveState === "signed-out" ? (
            <>
              {SAVE_COPY[saveState]}{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </>
          ) : (
            SAVE_COPY[saveState]
          )}
        </p>
      </div>

      <button
        onClick={onRestart}
        className="mt-8 w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
      >
        Again
      </button>

      {wrong.length > 0 && (
        <div className="mt-8">
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Got wrong
          </p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {wrong.map((a, i) => {
              const { before, seat } = describeSpot(a.spot.node);
              return (
                <li
                  key={`${a.spot.itemKey}-${a.spot.hand}-${i}`}
                  className="flex items-baseline gap-3 py-2 text-sm"
                >
                  <span className="font-mono font-semibold">{a.spot.hand}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {before} · {seat}
                  </span>
                  <span className="ml-auto text-xs">
                    <span className="text-rose-600 line-through dark:text-rose-400">
                      {a.chosen}
                    </span>{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {a.expected}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
