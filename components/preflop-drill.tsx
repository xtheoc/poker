"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreflopGrid } from "@/components/preflop-grid";
import {
  type ActionKind,
  type ChartNode,
  offeredActions,
} from "@/lib/poker/charts";
import { type DrillHand, sampleDrillHands } from "@/lib/poker/drill";
import {
  type ActionGrade,
  type GradedAction,
  gradeAction,
  strategyBreakdown,
} from "@/lib/poker/grading";
import { type DrillResult, Rating, sessionRating } from "@/lib/srs";
import { cn } from "@/lib/utils";

const HANDS_PER_SESSION = 10;

const GRADE_STYLES: Record<ActionGrade, string> = {
  best: "bg-emerald-600 text-white",
  correct: "bg-teal-600 text-white",
  inaccuracy: "bg-amber-500 text-white",
  wrong: "bg-rose-600 text-white",
  blunder: "bg-rose-800 text-white",
};

const GRADE_LABELS: Record<ActionGrade, string> = {
  best: "Best",
  correct: "Correct",
  inaccuracy: "Inaccuracy",
  wrong: "Wrong",
  blunder: "Blunder",
};

const RATING_COPY: Record<number, { label: string; note: string }> = {
  [Rating.Again]: {
    label: "Again",
    note: "This one comes back today. Something in it cost real money.",
  },
  [Rating.Hard]: {
    label: "Hard",
    note: "Back soon. You know it, but not yet without thinking.",
  },
  [Rating.Good]: { label: "Good", note: "Solid. The interval grows." },
  [Rating.Easy]: {
    label: "Easy",
    note: "Fast and clean on an established spot. Pushed well out.",
  },
};

/** The sentence that says what happened before it's your turn. */
function situation(node: ChartNode): string {
  const { position, villain } = node.key;
  if (!villain) {
    return position === "SB"
      ? "Folded to you in the small blind."
      : `Folded to you in the ${position}.`;
  }
  const open = villain === "SB" ? "3bb" : "2.5bb";
  return `The ${villain} opens to ${open}. You're in the ${position}.`;
}

// `availableActions` lived here and inferred the buttons from whether there was
// a raiser — "this tree has no limping, so opening is raise-or-fold". That
// stopped being true the moment the charts began open-limping small pairs, and
// the drill started asking questions whose right answer was not on screen.
// `offeredActions` reads the node instead, so it cannot go stale that way again.

/** What the server needs to record one drilled hand. */
interface RecordedHand {
  hand: string;
  chosenAction: ActionKind;
  expectedAction: ActionKind;
  grade: ActionGrade;
  score: number;
  strategyFreq: number;
  evLossBb?: number;
  rngRoll?: number;
  durationMs: number;
}

/**
 * There is no "saving" member on purpose.
 *
 * Once the session has finished and a request is in flight, "still idle" and
 * "still saving" are the same state, so it is derived at render rather than
 * stored — which also keeps the effect from setting state synchronously and
 * cascading a render.
 */
type SaveState = "idle" | "saved" | "signed-out" | "failed";

export function PreflopDrill({
  node,
  itemKey,
}: {
  node: ChartNode;
  /**
   * The card this drill belongs to. When present, results are posted so the
   * scheduler remembers them; when absent — or when nobody is signed in — the
   * drill still works and simply forgets, which is the whole signed-out
   * experience.
   */
  itemKey?: string;
}) {
  const actions = useMemo(() => offeredActions(node), [node]);

  // Dealt once at mount rather than in an effect. Switching spots is handled by
  // the parent keying this component on the node id, so a change remounts and
  // re-deals — no synchronising needed, and no cascading render.
  //
  // Sampling here is safe despite being random: this component only ever mounts
  // after the drill tab is clicked, so it never renders on the server and there
  // is no hydration to mismatch.
  const [hands, setHands] = useState<DrillHand[]>(() =>
    sampleDrillHands(node, HANDS_PER_SESSION),
  );
  const [index, setIndex] = useState(0);
  const [graded, setGraded] = useState<GradedAction | null>(null);
  const [results, setResults] = useState<DrillResult[]>([]);
  const [recorded, setRecorded] = useState<RecordedHand[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const savedRef = useRef(false);

  const deal = useCallback(() => {
    setHands(sampleDrillHands(node, HANDS_PER_SESSION));
    setIndex(0);
    setGraded(null);
    setResults([]);
    setRecorded([]);
    setSaveState("idle");
    setStartedAt(Date.now());
    savedRef.current = false;
  }, [node]);

  const current = hands[index];
  const finished = hands.length > 0 && index >= hands.length;

  const answer = useCallback(
    (action: ActionKind) => {
      if (!current || graded) return;
      const result = gradeAction(current.strategy, action, { roll: current.roll });
      const durationMs = Date.now() - startedAt;
      setGraded(result);
      setResults((prev) => [
        ...prev,
        { grade: result.grade, score: result.score, durationMs },
      ]);
      setRecorded((prev) => [
        ...prev,
        {
          hand: current.hand,
          chosenAction: result.chosen,
          expectedAction: result.expected,
          grade: result.grade,
          score: result.score,
          strategyFreq: result.freq,
          evLossBb: result.evLossBb,
          rngRoll: current.roll,
          durationMs,
        },
      ]);
    },
    [current, graded, startedAt],
  );

  const next = useCallback(() => {
    setGraded(null);
    setIndex((i) => i + 1);
    setStartedAt(Date.now());
  }, []);

  // Keyboard answering, because a ten-minute daily habit lives or dies on
  // friction, and reaching for the mouse ten times is friction.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (finished) return;
      if (graded) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          next();
        }
        return;
      }
      const match: Record<string, ActionKind> = { f: "fold", c: "call", r: "raise" };
      const chosen = match[event.key.toLowerCase()];
      if (chosen && actions.includes(chosen)) answer(chosen);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, answer, finished, graded, next]);

  // Save once, when the session ends. This is a genuine external system to
  // synchronise with, which is exactly what an effect is for — and it must not
  // run per answer, or a half-finished drill would be scheduled as a whole one.
  useEffect(() => {
    if (!finished || !itemKey || recorded.length === 0) return;
    // A ref rather than state, so guarding against a second submission does not
    // itself trigger a render.
    if (savedRef.current) return;
    savedRef.current = true;

    let cancelled = false;

    fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // A list of one: this drill only ever works a single spot, but the
      // endpoint takes a batch so a quickfire run can post a dozen at once.
      body: JSON.stringify({ reviews: [{ itemKey, hands: recorded }] }),
    })
      .then((response) => {
        if (cancelled) return;
        // 401 is the ordinary signed-out case, not an error worth alarming
        // anyone about — the drill still happened, it just is not remembered.
        if (response.status === 401) setSaveState("signed-out");
        else if (response.ok) setSaveState("saved");
        else setSaveState("failed");
      })
      .catch(() => {
        if (!cancelled) setSaveState("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [finished, itemKey, recorded]);

  if (finished) {
    return (
      <Summary
        results={results}
        onRestart={deal}
        node={node}
        saveState={itemKey ? saveState : "signed-out"}
      />
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{situation(node)}</span>
        <span className="tabular-nums">
          {index + 1} / {hands.length}
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="font-mono text-5xl font-semibold tracking-tight sm:text-6xl">
          {current.hand}
        </div>

        {current.roll !== undefined && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Die rolled{" "}
            <span className="font-semibold text-sky-600 dark:text-sky-400">
              {current.roll}
            </span>{" "}
            — this spot is mixed, so the roll decides.
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => answer(action)}
              disabled={graded !== null}
              className={cn(
                "min-w-28 rounded-lg px-5 py-2.5 text-sm font-medium capitalize transition",
                "border border-zinc-300 dark:border-zinc-700",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                "disabled:cursor-default disabled:opacity-100",
                graded?.chosen === action && GRADE_STYLES[graded.grade],
                graded !== null &&
                  graded.chosen !== action &&
                  graded.expected === action &&
                  "border-emerald-500 text-emerald-600 dark:text-emerald-400",
              )}
            >
              {action}
              <span className="ml-1.5 text-xs opacity-50">
                {action[0].toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </div>

      {graded && <Feedback graded={graded} hand={current} onNext={next} />}

      <details>
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Show the chart
        </summary>
        <div className="mt-3">
          <PreflopGrid node={node} highlight={current.hand} />
        </div>
      </details>
    </div>
  );
}

function Feedback({
  graded,
  hand,
  onNext,
}: {
  graded: GradedAction;
  hand: DrillHand;
  onNext: () => void;
}) {
  const breakdown = strategyBreakdown(hand.strategy);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
            GRADE_STYLES[graded.grade],
          )}
        >
          {GRADE_LABELS[graded.grade]}
        </span>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{graded.rationale}</p>
      </div>

      {/* Showing the whole distribution immediately is not decoration: feedback
          given right after retrieval is one of the conditions under which
          testing yourself measurably strengthens memory. */}
      <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium">Chart:</span>
        {breakdown.map(({ action, freq, ev }) => (
          <span key={action} className="capitalize">
            {action} {Math.round(freq * 100)}%
            {ev !== undefined && ` (${ev.toFixed(2)}bb)`}
          </span>
        ))}
        {graded.evLossBb !== undefined && graded.evLossBb > 0 && (
          <span className="text-rose-600 dark:text-rose-400">
            −{graded.evLossBb.toFixed(2)}bb
          </span>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Next <span className="ml-1 opacity-50">↵</span>
      </button>
    </div>
  );
}

const SAVE_COPY: Record<SaveState, string | null> = {
  // Once the drill has finished, "idle" means the request is still in flight.
  idle: "Saving…",
  saved: "Saved. This spot is now in your queue.",
  // Said plainly rather than nagging: the drill was still worth doing.
  "signed-out": "Not saved — sign in to have this scheduled for you.",
  failed: "Could not save that one. The drill still counted for you, not for the queue.",
};

function Summary({
  results,
  onRestart,
  node,
  saveState,
}: {
  results: DrillResult[];
  onRestart: () => void;
  node: ChartNode;
  saveState: SaveState;
}) {
  const rating = sessionRating(results);
  const copy = RATING_COPY[rating];
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.grade] = (acc[r.grade] ?? 0) + 1;
    return acc;
  }, {});
  const clean = (counts.best ?? 0) + (counts.correct ?? 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 p-6 text-center dark:border-zinc-800">
        <div className="text-3xl font-semibold tabular-nums">
          {clean} / {results.length}
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          played correctly
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(Object.keys(GRADE_LABELS) as ActionGrade[])
            .filter((g) => counts[g])
            .map((g) => (
              <span
                key={g}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  GRADE_STYLES[g],
                )}
              >
                {counts[g]} {GRADE_LABELS[g].toLowerCase()}
              </span>
            ))}
        </div>

        <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-sm">
            <span className="font-medium">Scheduled: {copy.label}.</span>{" "}
            <span className="text-zinc-500 dark:text-zinc-400">{copy.note}</span>
          </p>
          {SAVE_COPY[saveState] && (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              {SAVE_COPY[saveState]}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={onRestart}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Drill this spot again
      </button>

      <PreflopGrid node={node} />
    </div>
  );
}
