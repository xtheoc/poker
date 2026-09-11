/**
 * A strategy is a complete, self-contained poker learning system.
 *
 * It bundles everything the app needs to teach, drill and grade one approach
 * to the game: the chart set, the rules engine, the playbook (cheat sheet),
 * the curriculum, the KPI definitions, and the automatic hand-tagging rule.
 *
 * The interface is deliberately wide enough that two strategies can differ in
 * every dimension — chart structure, drill modes, stat tracking, UI colour —
 * without any shared code needing to know. The only contract is this shape.
 *
 * **Why strategies live in `lib/strategies/` rather than a top-level folder.**
 * Moving `lib/poker/charts.ts` or `lib/playstyle.ts` would break every
 * existing import for zero architectural gain. A strategy *references* the
 * engine files; it does not *own* them. Two strategies could share the same
 * hand parser and the same FSRS scheduler while differing on everything else.
 */

import type { ChartSet, Position } from "../poker/charts";
import type { PlaySection } from "../playstyle";
import {
  type StrategyLearningSystem,
  validateLearningSystem,
} from "./learning";
import { CTM_NL2 } from "./ctm-nl2";

// ---------------------------------------------------------------------------
// Hand matching — how the app knows which strategy a hand belongs to
// ---------------------------------------------------------------------------

export interface HandMatchRule {
  /** Human-readable description shown in settings, e.g. "All NL2 cash hands". */
  label: string;
  /**
   * Returns true when a hand belongs to this strategy.
   *
   * Called during import with the parsed hand's metadata. The fields mirror
   * what `played_hand` already stores, so no extra parsing is needed.
   */
  match: (hand: HandMatchInput) => boolean;
}

export interface HandMatchInput {
  bigBlind: number;
  currency?: string;
  gameType: "cash" | "tournament";
  maxSeats?: number;
  fastFold: boolean;
}

// ---------------------------------------------------------------------------
// Curriculum — the sequenced learning path
// ---------------------------------------------------------------------------

export interface Lesson {
  id: string;
  title: string;
  /** Short summary shown in the lesson list. */
  summary: string;
  /**
   * Which playbook section IDs this lesson unlocks.
   *
   * As the user completes lessons, the playbook grows. This is the mapping
   * from "you read the lesson on facing 3-bets" to "the facing-3bet section
   * now appears on your cheat sheet".
   */
  unlocksPlaybook: string[];
  /**
   * Gate to advance past this lesson.
   *
   * null means the lesson is ungated — read it and move on. A gate with
   * `drillScore` requires hitting that accuracy on the associated drill
   * mode. A gate with `reps` requires that many drill repetitions.
   */
  gate: LessonGate | null;
}

export interface LessonGate {
  /** Which drill mode this gate applies to, e.g. "random", "ranges". */
  drillMode?: string;
  /** Minimum accuracy percentage (0–100) to pass. */
  drillScore?: number;
  /** Minimum number of drill repetitions. */
  reps?: number;
}

// ---------------------------------------------------------------------------
// KPIs — strategy-specific stats shown on the dashboard
// ---------------------------------------------------------------------------

export interface KpiDefinition {
  id: string;
  label: string;
  /** How to compute this KPI from the stored hand data. */
  compute: "vpip" | "pfr" | "accuracy" | "netBb" | "hands";
  /** Format string: "percent", "bb", "count". */
  format: "percent" | "bb" | "count";
}

/**
 * The written counterpart of an opening chart.
 *
 * A 13-by-13 grid is good for recognising its shape; this is good for
 * reviewing exactly what widens from seat to seat. It belongs to a strategy,
 * not to the shared chart engine, because a strategy can deliberately refine a
 * source's notation without changing any other strategy's teaching material.
 */
export interface StrategyRangeReference {
  position: Position;
  raise?: string;
  call?: string;
  caveat?: string;
}

// ---------------------------------------------------------------------------
// The strategy itself
// ---------------------------------------------------------------------------

export interface Strategy {
  /** Unique, URL-safe identifier. Used in routes and DB rows. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** One-line tagline shown on the global home. */
  tagline: string;

  /** The chart set this strategy grades against. */
  chartSet: ChartSet;
  /** Written opening ranges, if this strategy teaches a fixed baseline. */
  rangeReference?: readonly StrategyRangeReference[];
  /** The playbook (cheat sheet) sections. */
  playbook: readonly PlaySection[];
  /** The ordered curriculum. */
  curriculum: readonly Lesson[];

  /** Which stats to show on the strategy dashboard. */
  kpis: readonly KpiDefinition[];
  /** How to automatically assign imported hands to this strategy. */
  matchRule: HandMatchRule;
  /**
   * The mastery-gated learning system. Optional only while the existing
   * BlackRain draft remains deliberately unregistered; every strategy shown
   * to a learner must provide one.
   */
  learning?: StrategyLearningSystem;
}

// ---------------------------------------------------------------------------
// Registry — the single place the app looks up strategies
// ---------------------------------------------------------------------------

const REGISTRY = new Map<string, Strategy>();

export function registerStrategy(strategy: Strategy): void {
  if (REGISTRY.has(strategy.id)) {
    throw new Error(
      `Strategy "${strategy.id}" is already registered. ` +
        `Duplicate registrations are a bug, not a race condition.`,
    );
  }
  if (strategy.learning) validateLearningSystem(strategy.learning);
  REGISTRY.set(strategy.id, strategy);
}

export function getStrategy(id: string): Strategy | undefined {
  return REGISTRY.get(id);
}

export function getAllStrategies(): Strategy[] {
  return Array.from(REGISTRY.values());
}

/** Strategies without a learning system are drafts, never learner-facing. */
export function isLearningStrategy(
  strategy: Strategy,
): strategy is Strategy & { learning: StrategyLearningSystem } {
  return strategy.learning !== undefined;
}

export function getLearningStrategy(
  id: string,
): (Strategy & { learning: StrategyLearningSystem }) | undefined {
  const strategy = getStrategy(id);
  return strategy && isLearningStrategy(strategy) ? strategy : undefined;
}

/**
 * Find the strategy that claims this hand.
 *
 * Returns the first match. If two strategies would both match (e.g. a
 * general "all cash" and a specific "NL2 cash"), the more specific one
 * should be registered first.
 */
export function matchStrategy(hand: HandMatchInput): Strategy | undefined {
  for (const strategy of REGISTRY.values()) {
    if (strategy.matchRule.match(hand)) return strategy;
  }
  return undefined;
}

// Built-in strategies register once when this module is first loaded. Strategy
// manifests import this module's types only, keeping this registry acyclic.
registerStrategy(CTM_NL2);
