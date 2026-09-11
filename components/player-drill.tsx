"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HudPanel } from "@/components/hud-panel";
import { HudReference } from "@/components/hud-reference";
import { type HudRead, dealHud } from "@/lib/hud/deal";
import { PLAYER_TYPES, type PlayerTypeId, playerType } from "@/lib/hud/players";
import { type TableFormat, blindedAt, visibleStats } from "@/lib/hud/stats";
import { cn } from "@/lib/utils";

/**
 * Reading a stranger from his numbers.
 *
 * The skill is not arithmetic, it is recognition: a shape appears over a seat
 * and you have about two seconds to decide whether the money at this table is
 * his or yours. So the drill is built the way the preflop one is — one screen,
 * one keypress, a streak that ends the moment you are wrong — and for the same
 * reason: speed is what is being trained, and anything you have to stop and
 * read is training something else.
 *
 * The hand count is part of the puzzle rather than decoration. It is rolled
 * first and decides how much of the HUD you get, so a good share of deals hand
 * you two numbers and a row of dashes and still expect an answer. That is the
 * situation that actually costs money at a table, and it is answerable because
 * the five archetypes have five distinct VPIP/PFR colour pairs.
 *
 * Not wired into the spaced-repetition scheduler. Those cards are keyed on
 * chart nodes, and minting item keys for a different skill would drop unrelated
 * reviews into the same deck as your preflop ranges. A streak is the honest
 * counter until player reads earn a card type of their own.
 */

/** Where the best streak lives between visits. See the preflop drill's copy. */
const BEST_KEY = "player-drill-best-streak";

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

function writeBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Not remembering is survivable; failing to record it must not stop play.
  }
  for (const listener of bestListeners) listener();
}

/** Keys 1-5, in the order the buttons sit. */
const KEYS = ["1", "2", "3", "4", "5"];

/** Streak at which the deals are as hard as they get. */
const HARDEST_AT = 12;

// `blindedAt` and its thresholds live in lib/hud/stats.ts, where they can be
// tested without driving a browser.

/**
 * How hard the next read should be, given how well it is going.
 *
 * Ramped rather than fixed, because the two readings of "too easy" want
 * opposite things. Early on the archetypes are still being learned and clean
 * examples are what teach them; once you are ten deep you have learned them and
 * clean examples are just typing. Tying difficulty to the streak means the
 * drill gets hard exactly when it has evidence you can take it, and resets when
 * it has evidence you cannot.
 *
 * Nothing here changes the right answer — see `borderline` in the dealer. A
 * hard deal is one where the numbers sit on their band edges and you have to
 * read them properly instead of glancing at two colours.
 */
function difficultyAt(streak: number): number {
  return Math.min(1, streak / HARDEST_AT);
}

export function PlayerDrill({
  initial,
  format = "6max",
  masteryStreak,
  onMastery,
}: {
  /**
   * The first read, dealt on the server.
   *
   * Dealing is random, and random during render makes a component's output
   * depend on when it ran. Every later deal comes from a click, where that is
   * not a problem.
   */
  initial: HudRead;
  format?: TableFormat;
  /** Optional lesson gate. Omitted for the free-play drill. */
  masteryStreak?: number;
  onMastery?: (result: { score: number; durationMs: number; answers: number }) => void;
}) {
  const [read, setRead] = useState<HudRead>(initial);
  const [answer, setAnswer] = useState<PlayerTypeId | null>(null);
  const [streak, setStreak] = useState(0);
  const [lost, setLost] = useState<number | null>(null);
  // Free to open, unlike the preflop chart. See `HudReference` for why.
  const [showRef, setShowRef] = useState(false);
  const [mastered, setMastered] = useState(false);
  const best = useSyncExternalStore(subscribeBest, readBest, serverBest);
  const startedAt = useRef<number | null>(null);
  const answers = useRef(0);
  const reported = useRef(false);

  const right = answer !== null && answer === read.type;

  const next = useCallback(
    (from: number) => {
      setRead(dealHud({ format, difficulty: difficultyAt(from) }));
      setAnswer(null);
    },
    [format],
  );

  const guess = useCallback(
    (id: PlayerTypeId) => {
      if (answer) return;
      if (startedAt.current === null) startedAt.current = Date.now();
      answers.current++;
      setAnswer(id);

      if (id === read.type) {
        const going = streak + 1;
        setStreak(going);
        if (going > best) writeBest(going);
        setLost(null);
        if (masteryStreak !== undefined && going >= masteryStreak && !reported.current) {
          reported.current = true;
          setMastered(true);
          onMastery?.({
            score: 100,
            durationMs: Date.now() - (startedAt.current ?? Date.now()),
            answers: answers.current,
          });
        }
      } else {
        setLost(streak > 0 ? streak : null);
        setStreak(0);
      }
    },
    [answer, best, masteryStreak, onMastery, read.type, streak],
  );

  // The streak the *next* deal will be pitched against. Read from state rather
  // than recomputed, so it reflects the answer just given.
  const advance = useCallback(() => next(streak), [next, streak]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const key = event.key;

      // Any answer key moves on once the verdict is up, so a fast player is
      // never held behind an explanation they have already read.
      if (mastered) return;
      if (answer) {
        if (KEYS.includes(key) || key === " " || key === "Enter") {
          event.preventDefault();
          advance();
        }
        return;
      }

      const index = KEYS.indexOf(key);
      if (index < 0 || index >= PLAYER_TYPES.length) return;
      event.preventDefault();
      guess(PLAYER_TYPES[index].id);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, answer, guess, mastered]);

  const restart = useCallback(() => {
    setRead(dealHud({ format, difficulty: 0 }));
    setAnswer(null);
    setStreak(0);
    setLost(null);
    setMastered(false);
    startedAt.current = null;
    answers.current = 0;
    reported.current = false;
  }, [format]);

  if (mastered) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <p className="text-5xl font-semibold tabular-nums">{streak}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          correct player reads in a row
        </p>
        <button
          onClick={restart}
          className="mt-8 w-full max-w-xs rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Again
        </button>
      </div>
    );
  }

  const thin = visibleStats(read.hands).length <= 2;
  const blinded = blindedAt(streak);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex w-full max-w-sm items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-4xl font-semibold tabular-nums transition-colors",
              streak > 0
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-300 dark:text-zinc-700",
            )}
          >
            {streak}
          </span>
          {lost !== null && streak === 0 && (
            <span className="text-xs text-rose-600 dark:text-rose-400">
              lost {lost}
            </span>
          )}
        </div>
        <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          best {best}
        </span>
      </div>

      <div className="mt-6">
        {/* The colours come back the moment you answer, so the feedback still
            shows you the shape you were reading blind. */}
        <HudPanel
          read={read}
          showLabels={answer !== null}
          blind={answer ? [] : blinded}
        />
      </div>

      {blinded.length > 0 && !answer && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          {blinded.length === 1 ? "VPIP" : "VPIP and PFR"} greyed out — read the
          number, not the colour.
        </p>
      )}

      {thin && !answer && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          {read.hands} hands — VPIP and PFR are all you get. Read them.
        </p>
      )}

      {/* All five on one row wherever they fit: the answer is a comparison
          between them, and a set that wraps mid-list reads as two groups. */}
      <div className="mt-6 flex flex-wrap justify-center gap-1.5">
        {PLAYER_TYPES.map((type, i) => (
          <button
            key={type.id}
            onClick={() => guess(type.id)}
            className={cn(
              "w-[4.5rem] rounded-xl border py-3 text-sm font-medium transition",
              "border-zinc-300 dark:border-zinc-700",
              !answer && "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              // Your answer, right or wrong.
              answer === type.id &&
                (right
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-rose-500 bg-rose-500 text-white"),
              // And the truth, when you missed it.
              answer &&
                answer !== type.id &&
                read.type === type.id &&
                "border-emerald-500 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {type.label}
            <span className="mt-1 block text-[10px] opacity-40">{KEYS[i]}</span>
          </button>
        ))}
      </div>

      {answer && <Verdict read={read} />}

      {answer && (
        <button
          onClick={advance}
          className="mt-6 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Next →
        </button>
      )}

      <button
        onClick={() => setShowRef((open) => !open)}
        className={cn(
          "mt-8 text-xs transition",
          showRef
            ? "text-zinc-600 dark:text-zinc-300"
            : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300",
        )}
      >
        {showRef ? "Hide the types" : "Types & ranges"}
      </button>

      {showRef && <HudReference format={format} />}
    </div>
  );
}

/**
 * Why it was what it was.
 *
 * Shown only after answering, and it names the tell rather than restating the
 * numbers — those are still on screen. When a stat was knocked off its
 * archetype, that is said out loud: a HUD that does not quite fit is the normal
 * case, and answering anyway is most of the skill.
 */
function Verdict({ read }: { read: HudRead }) {
  const type = playerType(read.type);

  return (
    <div className="mt-5 max-w-sm text-center">
      <p className="text-sm font-medium">
        {type.label}
        <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">
          typically {type.anchor[read.format]}
        </span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {type.tell}
      </p>
      {read.odd && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          One stat was off the pattern here, as they often are.
        </p>
      )}
    </div>
  );
}
