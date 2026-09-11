/** Turn strategy-review evidence into one unlimited practice deck. */

import type { Violation } from "../leaks";
import type { LeakTarget } from "../poker/leak-drill";

/**
 * One target per decision shape, newest mistake first.
 *
 * The drill intentionally has no confidence threshold and no due date. A
 * verified mistake is useful practice immediately; confidence is only useful
 * when naming a long-term leak on the dashboard.
 */
export function strategyMistakeTargets(
  violations: readonly Violation[],
): LeakTarget[] {
  const targets = new Map<string, LeakTarget>();

  for (const violation of violations) {
    const current = targets.get(violation.nodeId);
    if (current) {
      if (!current.hands.includes(violation.hand)) current.hands.push(violation.hand);
      current.instances += 1;
      current.score += violation.evLossBb ?? 1;
      if (violation.playedAt > current.lastSeenAt) current.lastSeenAt = violation.playedAt;
      continue;
    }

    targets.set(violation.nodeId, {
      nodeId: violation.nodeId,
      spot: violation.spot,
      label: violation.spot,
      hands: [violation.hand],
      score: violation.evLossBb ?? 1,
      instances: 1,
      lastSeenAt: violation.playedAt,
    });
  }

  return [...targets.values()].sort(
    (a, b) =>
      b.lastSeenAt.getTime() - a.lastSeenAt.getTime() ||
      b.score - a.score,
  );
}
