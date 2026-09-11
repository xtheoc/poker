"use client";

import { useCallback, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { SUIT_PIPS, type Card } from "@/lib/poker/cards";
import {
  CONTINUE_LABEL,
  CTM_FLOP_SPOTS,
  gradeExact,
  SIZE_LABEL,
  STOP_LABEL,
  TURN_LABEL,
  type CbetSize,
  type ContinueGroup,
  type FlopPlanSpot,
  type HelpfulTurn,
  type StopPlan,
} from "@/lib/strategies/ctm-flop";
import { cn } from "@/lib/utils";

type Step = "callers" | "turns" | "stop" | "size";

const STEPS: readonly Step[] = ["callers", "turns", "stop", "size"];
const STEP_LABEL: Record<Step, string> = {
  callers: "Who continues?",
  turns: "Which turns help?",
  stop: "Where do you stop?",
  size: "C-bet size",
};

const CONTINUE_OPTIONS = Object.keys(CONTINUE_LABEL) as ContinueGroup[];
const TURN_OPTIONS = Object.keys(TURN_LABEL) as HelpfulTurn[];
const STOP_OPTIONS = Object.keys(STOP_LABEL) as StopPlan[];
const SIZE_OPTIONS = ["check", "50-55", "60", "75", "100", "100+"] as const satisfies readonly CbetSize[];

function CardFace({ card }: { card: Card }) {
  const suit = SUIT_PIPS[card.suit];
  return (
    <span className={cn(
      "flex h-16 w-12 flex-col items-center justify-center rounded-md border border-zinc-300 bg-white shadow-sm",
      suit.red ? "text-rose-600" : "text-zinc-900",
    )}>
      <span className="text-xl font-bold leading-none">{card.rank}</span>
      <span className="text-base leading-none">{suit.pip}</span>
    </span>
  );
}

function SelectionButton({
  selected,
  children,
  onClick,
  disabled,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2.5 text-left text-sm transition",
        selected
          ? "border-sky-500 bg-sky-500/10 font-medium text-sky-700 dark:text-sky-300"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600",
        disabled && "cursor-default",
      )}
    >
      {children}
    </button>
  );
}

function expectedFor(step: Step, spot: FlopPlanSpot): string {
  if (step === "callers") return spot.continues.map((item) => CONTINUE_LABEL[item]).join(" · ");
  if (step === "turns") return spot.helpfulTurns.map((item) => TURN_LABEL[item]).join(" · ");
  if (step === "stop") return STOP_LABEL[spot.stop];
  return SIZE_LABEL[spot.size];
}

/**
 * The flop decision is deliberately not one button press. This is the order
 * the learner should use at the table: name what stays in, name what can make
 * a later bet sensible, decide the stop point, then choose the size.
 */
export function FlopPlanDrill({
  spots = CTM_FLOP_SPOTS,
  onComplete,
}: {
  spots?: readonly FlopPlanSpot[];
  onComplete?: (result: { score: number; durationMs: number; answers: number }) => void;
}) {
  const [spotIndex, setSpotIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [continues, setContinues] = useState<ContinueGroup[]>([]);
  const [turns, setTurns] = useState<HelpfulTurn[]>([]);
  const [stop, setStop] = useState<StopPlan | null>(null);
  const [size, setSize] = useState<CbetSize | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState({ score: 0, correct: 0, answers: 0 });
  const startedAt = useRef<number | null>(null);
  const correctParts = useRef(0);
  const answeredParts = useRef(0);
  const reported = useRef(false);

  const spot = spots[spotIndex];
  const step = STEPS[stepIndex];

  const start = useCallback(() => {
    if (startedAt.current === null) startedAt.current = Date.now();
  }, []);

  const toggleContinue = useCallback((value: ContinueGroup) => {
    start();
    setContinues((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }, [start]);

  const toggleTurn = useCallback((value: HelpfulTurn) => {
    start();
    setTurns((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }, [start]);

  const submit = useCallback(() => {
    if (!spot || correct !== null) return;
    start();
    const right = step === "callers"
      ? gradeExact(continues, spot.continues)
      : step === "turns"
        ? gradeExact(turns, spot.helpfulTurns)
        : step === "stop"
          ? stop === spot.stop
          : size === spot.size;
    answeredParts.current += 1;
    if (right) correctParts.current += 1;
    setCorrect(right);
  }, [continues, correct, size, spot, start, step, stop, turns]);

  const next = useCallback(() => {
    if (!spot || correct === null) return;
    setCorrect(null);
    if (stepIndex + 1 < STEPS.length) {
      setStepIndex((index) => index + 1);
      return;
    }
    if (spotIndex + 1 < spots.length) {
      setSpotIndex((index) => index + 1);
      setStepIndex(0);
      setContinues([]);
      setTurns([]);
      setStop(null);
      setSize(null);
      return;
    }
    const final = {
      score: Math.round((correctParts.current / Math.max(1, answeredParts.current)) * 100),
      correct: correctParts.current,
      answers: answeredParts.current,
    };
    setSummary(final);
    setFinished(true);
    if (!reported.current) {
      reported.current = true;
      onComplete?.({
        score: final.score,
        durationMs: Date.now() - (startedAt.current ?? Date.now()),
        answers: answeredParts.current,
      });
    }
  }, [correct, onComplete, spot, spotIndex, spots.length, stepIndex]);

  const restart = useCallback(() => {
    setSpotIndex(0);
    setStepIndex(0);
    setContinues([]);
    setTurns([]);
    setStop(null);
    setSize(null);
    setCorrect(null);
    setFinished(false);
    setSummary({ score: 0, correct: 0, answers: 0 });
    startedAt.current = null;
    correctParts.current = 0;
    answeredParts.current = 0;
    reported.current = false;
  }, []);

  if (finished) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <p className="text-5xl font-semibold tabular-nums">{summary.score}%</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{summary.correct} of {summary.answers} planning decisions</p>
        <button onClick={restart} className="mt-8 w-full max-w-xs rounded-md bg-zinc-900 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Again</button>
      </div>
    );
  }
  if (!spot || !step) return null;

  const multi = step === "callers" || step === "turns";
  const ready = step === "callers" ? continues.length > 0
    : step === "turns" ? turns.length > 0
      : step === "stop" ? stop !== null
        : size !== null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-baseline justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">Flop plan</p>
          <p className="mt-1 text-sm font-semibold">{spotIndex + 1} of {spots.length} · {STEP_LABEL[step]}</p>
        </div>
        <span className="font-mono text-xs text-zinc-400">{stepIndex + 1} / {STEPS.length}</span>
      </div>

      <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">Hero</p>
            <div className="mt-2 flex gap-1.5">{spot.hero.map((card, index) => <CardFace key={index} card={card} />)}</div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">Flop</p>
            <div className="mt-2 flex gap-1.5">{spot.board.map((card, index) => <CardFace key={index} card={card} />)}</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{spot.context}</p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-400">{spot.position} · vs {spot.villain}</p>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight">{step === "callers" && "If you put money in, who continues?"}{step === "turns" && "Which turns make a later bet make sense?"}{step === "stop" && "Set your stop point before investing."}{step === "size" && "Only now choose the c-bet size."}</h2>
        {multi && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Select every correct group.</p>}

        {step === "callers" && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {CONTINUE_OPTIONS.map((option) => <SelectionButton key={option} selected={continues.includes(option)} disabled={correct !== null} onClick={() => toggleContinue(option)}>{CONTINUE_LABEL[option]}</SelectionButton>)}
          </div>
        )}
        {step === "turns" && (
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {TURN_OPTIONS.map((option) => <SelectionButton key={option} selected={turns.includes(option)} disabled={correct !== null} onClick={() => toggleTurn(option)}>{TURN_LABEL[option]}</SelectionButton>)}
          </div>
        )}
        {step === "stop" && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {STOP_OPTIONS.map((option) => <SelectionButton key={option} selected={stop === option} disabled={correct !== null} onClick={() => { start(); setStop(option); }}>{STOP_LABEL[option]}</SelectionButton>)}
          </div>
        )}
        {step === "size" && (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SIZE_OPTIONS.map((option) => <SelectionButton key={option} selected={size === option} disabled={correct !== null} onClick={() => { start(); setSize(option); }}>{SIZE_LABEL[option]}</SelectionButton>)}
          </div>
        )}
      </div>

      {correct === null ? (
        <button disabled={!ready} onClick={submit} className="mt-6 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-zinc-900">Check plan</button>
      ) : (
        <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className={cn("flex items-center gap-2 text-sm font-medium", correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {correct ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
            {correct ? "Correct" : `Answer: ${expectedFor(step, spot)}`}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{spot.explanation}</p>
          <button onClick={next} className="mt-4 text-sm font-medium underline underline-offset-4">{stepIndex + 1 === STEPS.length && spotIndex + 1 === spots.length ? "Finish" : "Next"}</button>
        </div>
      )}
    </div>
  );
}
