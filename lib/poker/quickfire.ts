/**
 * Dealing random spots.
 *
 * The per-node drill answers "do I know the cutoff opening range". This answers
 * the question that actually matters at a table: **a spot arrives, unannounced,
 * and you have about a second.** Recognising which situation you are in is
 * itself a skill, and drilling one node at a time quietly does that part for
 * you — you already know the answer is about the cutoff before the hand appears.
 *
 * Nodes are drawn uniformly rather than at the rate they occur in play. Even
 * coverage is what a study tool wants: realistic frequencies would spend most
 * of the session on the handful of common spots and almost never show the rest,
 * which is the opposite of finding the gaps.
 */

import {
  type ChartNode,
  type ChartSet,
  type Strategy,
  isMixed,
  nodeId,
  strategyFor,
} from "./charts";
import { type Card, cardsFor } from "./cards";
import { sampleDrillHands } from "./drill";
import type { Hand } from "./hands";

export interface QuickfireSpot {
  node: ChartNode;
  /** Stable id of the node, which is also the card's item key. */
  itemKey: string;
  hand: Hand;
  strategy: Strategy;
  /**
   * The two cards to show, chosen to match the class.
   *
   * Cosmetic — grading reads `hand` — but chosen here rather than at render
   * time, because a component that picks suits while rendering deals a
   * different hand on every re-render.
   */
  cards: [Card, Card] | null;
  /** The 1-100 roll, present only where the node genuinely mixes. */
  roll?: number;
}

export interface QuickfireOptions {
  /**
   * Hands previously misplayed, per node id.
   *
   * Threaded straight through to the sampler, so the spots you keep getting
   * wrong come round more often without the deck needing a card per hand.
   */
  errorCounts?: ReadonlyMap<string, ReadonlyMap<Hand, number>>;
  /** Share of dealt hands the chart actually plays. */
  playRatio?: number;
  rng?: () => number;
}

/**
 * Deal one spot.
 *
 * Returns null only for an empty chart set, which would be a packaging error
 * rather than something a caller can handle.
 */
export function dealSpot(
  set: ChartSet,
  options: QuickfireOptions = {},
): QuickfireSpot | null {
  const { rng = Math.random } = options;
  if (set.nodes.length === 0) return null;

  const node = set.nodes[Math.floor(rng() * set.nodes.length)];
  const key = nodeId(node.key);

  const [dealt] = sampleDrillHands(node, 1, {
    playRatio: options.playRatio,
    errorCounts: options.errorCounts?.get(key),
    rng,
  });
  if (!dealt) return null;

  const strategy = strategyFor(node, dealt.hand);
  return {
    node,
    itemKey: key,
    hand: dealt.hand,
    strategy,
    cards: cardsFor(dealt.hand, rng),
    roll: isMixed(strategy) ? 1 + Math.floor(rng() * 100) : undefined,
  };
}

/**
 * Deal a whole session up front.
 *
 * Dealt in advance rather than one at a time so the run cannot stall between
 * hands — the entire point is that it moves quickly. Consecutive spots are
 * never the same node, because two cutoff opens in a row makes the second one
 * a memory test rather than a recognition test.
 */
export function dealSession(
  set: ChartSet,
  count: number,
  options: QuickfireOptions = {},
): QuickfireSpot[] {
  const spots: QuickfireSpot[] = [];
  let lastKey: string | null = null;

  // A bounded number of attempts: with a single-node chart set there is no way
  // to avoid a repeat, and looping forever would be worse than allowing one.
  const maxAttempts = count * 8;
  for (let attempt = 0; spots.length < count && attempt < maxAttempts; attempt++) {
    const spot = dealSpot(set, options);
    if (!spot) break;
    if (spot.itemKey === lastKey && set.nodes.length > 1) continue;
    spots.push(spot);
    lastKey = spot.itemKey;
  }

  return spots;
}

/**
 * The situation, in as few words as it can be said.
 *
 * Two short fragments rather than a sentence: at speed you are pattern-matching
 * a shape, not reading prose, and "The BTN opens to 2.5bb. You're in the BB."
 * takes long enough to parse that it becomes the slow part of the drill.
 */
export function describeSpot(node: ChartNode): { before: string; seat: string } {
  const { position, villain } = node.key;
  if (villain) return { before: `${villain} opens`, seat: position };

  // Three or more players already in for one blind. The count is the whole
  // reason this range differs from the opening one, so it has to be said.
  if (node.key.scenario === "vs-limp") {
    return { before: "Three limpers", seat: position };
  }

  // "Folded to you" in the big blind is not a spot — everyone folding means the
  // blind has already won and never acts. The only way that node is reached is
  // limpers, so it has to say so.
  return {
    before: position === "BB" ? "Limped to you" : "Folded to you",
    seat: position,
  };
}
