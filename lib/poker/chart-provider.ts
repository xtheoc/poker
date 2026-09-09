/**
 * The chart as a verdict source.
 *
 * This is the only source in version one that answers with certainty, and the
 * reason preflop analysis works on day one while postflop does not. Given a
 * position, the action before, and an exact hand, the chart returns an answer
 * that is a fact about that one decision rather than an inference from a
 * sample. Twenty chart violations out of two hundred preflop decisions is real
 * signal immediately, where twenty data points of a frequency statistic is
 * noise.
 *
 * It declines — returns null — for every spot outside its tree. That is most of
 * poker, and saying so is the point.
 */

import type { DecisionPoint, SyncVerdictProvider, Verdict } from "../verdict";
import {
  type ChartSet,
  type Strategy,
  bestAction,
  findNode,
  nodeId,
  strategyFor,
} from "./charts";

export function chartProvider(set: ChartSet): SyncVerdictProvider {
  return {
    source: "chart",
    getVerdict(decision: DecisionPoint): Verdict | null {
      if (decision.street !== "preflop" || !decision.node) return null;

      // The decision must belong to the same betting tree the chart describes.
      // A 2.5x-open chart says nothing useful about a pot opened to 3x, and
      // answering anyway would grade a correct play against the wrong strategy.
      if (decision.node.treeId !== set.treeId) return null;

      const node = findNode(set, nodeId(decision.node));
      if (!node) return null;

      const strategy = strategyFor(node, decision.hand);
      return {
        source: "chart",
        confidence: "exact",
        strategy,
        best: bestAction(strategy),
        rationale: describe(set, strategy, decision),
        assumptions: [
          `${set.name}: ${set.stackBb}bb, ${set.treeId}.`,
          set.provider === "authored"
            ? "Hand-authored simplified ranges, not solver output."
            : `Source: ${set.provider}.`,
        ],
      };
    },
  };
}

function describe(
  set: ChartSet,
  strategy: Strategy,
  decision: DecisionPoint,
): string {
  const action = bestAction(strategy);
  const node = decision.node!;
  const where = node.villain
    ? `in the ${node.position} facing a ${node.villain} open`
    : `opening from the ${node.position}`;
  return `${set.name} plays ${decision.hand} as a ${action} ${where}.`;
}
