import { describe, expect, it } from "vitest";
import type { QuickfireSpot } from "../poker/quickfire";
import { CTM_NL2_CHART } from "./ctm-nl2";
import { ctmPreflopCorrection } from "./ctm-preflop-feedback";

function spot(scenario: QuickfireSpot["node"]["key"]["scenario"], hand: string): QuickfireSpot {
  const node = CTM_NL2_CHART.nodes.find((candidate) => candidate.key.scenario === scenario);
  if (!node) throw new Error(`Missing ${scenario} test node`);
  return {
    node,
    hand: hand as QuickfireSpot["hand"],
    itemKey: "test",
    strategy: { fold: { freq: 1 } },
    cards: [
      { rank: "A", suit: "s" },
      { rank: "K", suit: "h" },
    ],
  };
}

describe("CTM preflop corrections", () => {
  it("names value three-bets before the default fold explanation", () => {
    expect(ctmPreflopCorrection("facing-open", spot("vs-rfi", "AKo"), "raise"))
      .toContain("Three-bet for value");
  });

  it("keeps ordinary pocket pairs tied to the set-mining reason", () => {
    expect(ctmPreflopCorrection("facing-open", spot("vs-rfi", "55"), "call"))
      .toContain("set-mine");
  });

  it("separates the 100bb three-bet calling tier from four-bets", () => {
    expect(ctmPreflopCorrection("facing-3bet", spot("vs-3bet", "AQs"), "call"))
      .toContain("Call at 100bb");
  });

  it("keeps four-bet continuations limited to aces and kings", () => {
    expect(ctmPreflopCorrection("facing-4bet", spot("vs-4bet", "QQ"), "fold"))
      .toContain("AA and KK");
  });
});
