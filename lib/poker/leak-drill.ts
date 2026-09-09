/**
 * Turning your actual mistakes into tomorrow's drill.
 *
 * This is the join that makes the platform more than two tools sharing a nav
 * bar: the leak engine says where money is being lost, and this deals spots of
 * that exact shape. Nothing else the app does is worth as much per minute,
 * because it is the only part where the thing being practised was chosen by
 * evidence rather than by a curriculum.
 *
 * Two judgements are encoded here, and both are the difference between a drill
 * that transfers to the table and one that does not.
 *
 * **The exact hands you misplayed are over-weighted, not exclusive.** Drilling
 * only K3o teaches you that K3o folds. Mixing in its neighbours teaches you
 * where the range *ends*, which is the part that generalises — and the edge of
 * a range is where every close decision lives.
 *
 * **Only leaks with enough evidence get drilled.** A leak still marked
 * `watching` is a pattern that might be noise, and drilling noise builds a habit
 * against something that never happens. That gate lives in the leak engine and
 * is respected here rather than re-litigated.
 */

import type { Leak } from "../leaks";
import {
  type ChartNode,
  type ChartSet,
  isMixed,
  nodeId,
  strategyFor,
} from "./charts";
import { cardsFor } from "./cards";
import { sampleDrillHands } from "./drill";
import type { Hand } from "./hands";
import type { QuickfireSpot } from "./quickfire";

/** A node worth drilling, and why. */
export interface LeakTarget {
  nodeId: string;
  /** Human-readable, e.g. "BB vs BTN". */
  spot: string;
  /** What kind of error it is, in a phrase. */
  label: string;
  /** The hand classes actually misplayed here. */
  hands: Hand[];
  /** Ranking score from the leak engine. Comparable, not a currency. */
  score: number;
  instances: number;
  /** When this mistake was last made. Drives the order of the cycle. */
  lastSeenAt: Date;
}

/**
 * How often a dealt spot uses a hand actually misplayed, rather than any hand
 * from the node.
 *
 * Half. High enough that the session is clearly about your own errors, low
 * enough that you are learning a range rather than memorising a list of
 * answers — and low enough that the drill cannot be passed by recognising which
 * hands "the app always asks about".
 */
export const LEAK_HAND_SHARE = 0.5;

/**
 * Leaks worth drilling, most recent first.
 *
 * Ordered by when the mistake last happened rather than by what it costs. Both
 * orderings are defensible and they answer different questions: cost says what
 * deserves attention over a month, recency says what to look at tonight. For a
 * drill opened straight after a session, recency wins — the hand is still in
 * memory, and a correction lands hardest while it is.
 *
 * Cost survives as the tiebreak, so two mistakes from the same session still
 * come up worst-first.
 *
 * Drillability remains the leak engine's call: it requires a pattern across
 * more than one session before a mistake counts as a habit.
 */
export function leakTargets(leaks: readonly Leak[]): LeakTarget[] {
  return leaks
    .filter((leak) => leak.drillable && leak.hands.length > 0)
    .map((leak) => ({
      nodeId: leak.nodeId,
      spot: leak.spot,
      label: leak.label,
      hands: leak.hands,
      score: leak.score,
      instances: leak.instances,
      lastSeenAt: leak.lastSeenAt,
    }))
    .sort(
      (a, b) =>
        b.lastSeenAt.getTime() - a.lastSeenAt.getTime() || b.score - a.score,
    );
}

export interface LeakDealOptions {
  handShare?: number;
  /**
   * Where in the rotation to resume.
   *
   * The drill never ends, so it asks for batches. Passing the number already
   * dealt continues the cycle instead of restarting it at the newest leak
   * every twenty spots.
   */
  offset?: number;
  rng?: () => number;
}

/**
 * Deal from the leaks, in a cycle that does not end.
 *
 * A round robin rather than a weighted draw. The earlier version sampled nodes
 * by cost, which is right for choosing what to *work on* and wrong for a
 * session you sit down and grind: random selection means the same spot can
 * appear four times in six while another never shows up at all, and it gives no
 * sense of having been through the list. Rotating in order guarantees even
 * coverage and makes the drill feel like it is going somewhere.
 *
 * The hand changes on every pass even when the spot repeats, so coming back
 * round to "BB vs BTN" is a fresh decision rather than a remembered answer.
 *
 * Returns fewer spots than asked for only when the targets name no usable
 * situations at all.
 */
export function cycleLeakSpots(
  set: ChartSet,
  targets: readonly LeakTarget[],
  count: number,
  options: LeakDealOptions = {},
): QuickfireSpot[] {
  const { handShare = LEAK_HAND_SHARE, offset = 0, rng = Math.random } = options;

  const byId = new Map<string, ChartNode>(
    set.nodes.map((node) => [nodeId(node.key), node]),
  );
  // A leak can name a node this chart set no longer has, after a chart upgrade.
  // Dropping it beats dealing a spot with no strategy behind it.
  const pool = targets.filter((t) => byId.has(t.nodeId));
  if (pool.length === 0) return [];

  const spots: QuickfireSpot[] = [];
  const seen = new Set<string>();

  // Bounded: with one target and a handful of hands there is a limit to how
  // many distinct spots exist, and insisting on `count` would never terminate.
  const maxAttempts = count * 8;

  // One cursor, advanced once per attempt. Deriving the position from
  // `spots.length + attempt` instead moves it *twice* on every success, which
  // on an even-sized pool lands on the same leak every time — a cycle that
  // never cycles.
  let cursor = offset;

  for (
    let attempt = 0;
    spots.length < count && attempt < maxAttempts;
    attempt++, cursor++
  ) {
    const target = pool[((cursor % pool.length) + pool.length) % pool.length];
    const node = byId.get(target.nodeId);
    if (!node) continue;

    // No repeat inside one batch. Across batches a spot must be allowed back —
    // that is what makes this a cycle rather than a queue that runs dry.
    const fresh = (candidate: Hand | undefined): Hand | null =>
      candidate && !seen.has(`${target.nodeId}#${candidate}`) ? candidate : null;

    // Try the hand actually misplayed, then fall back to a neighbour. The
    // fallback matters more than it looks: a leak often has only one misplayed
    // hand, and skipping the turn when that hand has already come up would
    // hand the rotation to the next leak and quietly unbalance the whole batch.
    let hand =
      rng() < handShare
        ? fresh(target.hands[Math.floor(rng() * target.hands.length)])
        : null;
    for (let tries = 0; !hand && tries < 4; tries++) {
      hand = fresh(sampleDrillHands(node, 1, { rng })[0]?.hand);
    }
    if (!hand) continue;

    seen.add(`${target.nodeId}#${hand}`);

    const strategy = strategyFor(node, hand);
    spots.push({
      node,
      itemKey: target.nodeId,
      hand,
      strategy,
      cards: cardsFor(hand, rng),
      roll: isMixed(strategy) ? 1 + Math.floor(rng() * 100) : undefined,
    });
  }

  return spots;
}
