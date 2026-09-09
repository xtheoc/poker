import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { heroDecisions } from "./hand-history/decisions";
import { parseFile } from "./hand-history/parse";
import { heroResult } from "./hand-history/result";
import { type Violation, findLeaks, violationsInHand } from "./leaks";
import { findNode, nodeId } from "./poker/charts";
import { BEGINNER_6MAX } from "./poker/charts/beginner-6max";
import { leakTargets } from "./poker/leak-drill";
import {
  type SessionHand,
  groupSessions,
  resultsByPosition,
  statsFor,
} from "./sessions";

/**
 * The whole loop, end to end, without a database.
 *
 * Every other spec tests one module. This one asserts that a real file of hands
 * comes out the far end as a ranked, drillable leak carrying the hands that
 * prove it — which is the actual product, and the thing that breaks when two
 * modules each work and quietly disagree about an interface.
 *
 * It also carries the honesty check the build plan asks for: **feed the engine
 * hands played correctly and it must report nothing.** A leak detector that
 * finds leaks in good play is not a slightly worse tool, it is a harmful one,
 * because every hour it sends you to drill is an hour spent unlearning
 * something you were already doing right.
 */

const TREE = {
  treeId: BEGINNER_6MAX.treeId,
  chartStackBb: BEGINNER_6MAX.stackBb,
};

function run(text: string) {
  const { hands, errors } = parseFile(text);
  const violations: Violation[] = [];
  const sessionHands: SessionHand[] = [];

  for (const hand of hands) {
    const decisions = heroDecisions(hand, TREE);
    const found = violationsInHand(hand, decisions, BEGINNER_6MAX);
    violations.push(...found);

    const result = heroResult(hand);
    sessionHands.push({
      psHandId: hand.id,
      playedAt: hand.playedAt,
      netBb: result?.netBb ?? 0,
      vpip: result?.vpip ?? false,
      pfr: result?.pfr ?? false,
      sawFlop: result?.sawFlop ?? false,
      wentToShowdown: result?.wentToShowdown ?? false,
      wonAtShowdown: result?.wonAtShowdown ?? false,
      won: result?.won ?? false,
      // Mirrors importHands: only spots this chart set actually covers, so a
      // decision that is never graded never lands in the denominator.
      chartedDecisions: decisions.filter(
        (d) => d.node && findNode(BEGINNER_6MAX, nodeId(d.node)),
      ).length,
      mistakes: found.length,
      // The same source the importer uses, so this fixture keeps matching what
      // actually lands in the database.
      position: result?.position ?? null,
    });
  }

  const leaks = findLeaks(violations);
  return {
    hands,
    errors,
    violations,
    leaks,
    targets: leakTargets(leaks),
    sessionHands,
  };
}

const SAMPLE = readFileSync(
  join(process.cwd(), "fixtures", "sample-session.txt"),
  "utf8",
);

describe("a session of deliberately loose play", () => {
  const out = run(SAMPLE);

  it("reads every hand in the file", () => {
    expect(out.hands).toHaveLength(8);
    expect(out.errors).toHaveLength(0);
  });

  it("splits it into the two evenings it was played over", () => {
    const sessions = groupSessions(out.sessionHands);
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.hands.length)).toEqual([4, 4]);
  });

  it("grades only the spots the chart still covers", () => {
    // Two, from a fixture written to contain six mistakes. The chart changed
    // twice underneath it and both changes are visible here.
    //
    // Version 2 took BlackRain79's openers, and J8o from the cutoff went from
    // a mistake to an ordinary open. Version 3 dropped facing-a-raise
    // entirely, and the three blind-defence errors stopped being gradeable at
    // all — not forgiven, just outside what this chart has an opinion about.
    //
    // Six of these eight hands are now ungraded. That ratio is the real cost
    // of an openers-only chart, and it belongs in a test rather than in a
    // surprise about why accuracy is computed over so few decisions.
    expect(out.violations).toHaveLength(2);

    const misplayed = out.violations.map((v) => v.hand).sort();
    expect(misplayed).toEqual(["K3o", "T7o"]);
  });

  it("knows which seat every hand was played from", () => {
    // The silent failure this guards: if `position` stopped being populated
    // anywhere along parse → result → store, the "By seat" section would
    // simply render nothing and look like a deliberate empty state rather
    // than a broken pipeline.
    for (const hand of out.sessionHands) {
      expect(hand.position).not.toBeNull();
    }
  });

  it("attributes money to the seat it was lost from", () => {
    const results = resultsByPosition(out.sessionHands);

    expect(results.length).toBeGreaterThan(0);
    // Worst first is the ordering the page depends on.
    for (let i = 1; i < results.length; i++) {
      expect(results[i].netBb).toBeGreaterThanOrEqual(results[i - 1].netBb);
    }
    // Every hand lands in exactly one seat, so the totals must reconcile.
    const counted = results.reduce((sum, r) => sum + r.hands, 0);
    expect(counted).toBe(out.sessionHands.length);
  });

  it("calls this sample far too small to read as a win rate", () => {
    // Eight hands. The gate exists so a number like this is never presented
    // as a finding about a seat.
    const results = resultsByPosition(out.sessionHands);
    expect(results.every((r) => !r.reliable)).toBe(true);
  });

  it("names the habit rather than listing the hands", () => {
    // The point of grouping: "you open too wide in the cutoff" is a lesson,
    // "you misplayed K3o and T7o" is a list. The blind-defence habit this
    // fixture also contained is gone with the nodes that could see it.
    const kinds = out.leaks.map((l) => `${l.spot}#${l.kind}`).sort();
    expect(kinds).toEqual(["CO open#too-loose"]);
  });

  it("ranks playing too wide above folding too much", () => {
    // Both happened three times, so the ordering is entirely about which kind
    // of error costs more — and at micro stakes, playing too many hands wins.
    expect(out.leaks[0].kind).toBe("too-loose");
  });

  it("still drills the leak it can see, at lower confidence", () => {
    const co = out.leaks.find((l) => l.spot === "CO open");
    expect(co?.sessions).toBe(2);
    // Every verified violation is worth practising whatever its confidence.
    expect(co?.drillable).toBe(true);
    expect(out.targets).toHaveLength(1);

    // Two instances, under the three needed to call a pattern established.
    expect(co?.confidence).toBe("watching");
  });

  it("keeps the hands that prove the leak", () => {
    const co = out.leaks.find((l) => l.spot === "CO open");
    expect(co?.handIds).toHaveLength(2);
    expect(co?.hands.slice().sort()).toEqual(["K3o", "T7o"]);
  });

  it("reports accuracy over the spots it can actually grade", () => {
    const stats = statsFor(out.sessionHands);
    // Eight hands played: five first into the pot, two of those opened too
    // wide, and three blind defences facing a raise.
    //
    // This read 5 until version 9. Those three defences were folds against a
    // single raise — real decisions the extractor had been tagging with
    // `vs-rfi` node ids for a while, against a chart set holding no such node,
    // so they dropped out of the denominator entirely. Adding the scenario
    // picks all three up, and the folds were correct, so accuracy rises
    // because more correct play is being counted rather than because anything
    // got easier.
    //
    // The direction is the thing to watch. A denominator growing while
    // mistakes hold is the healthy shape; mistakes rising alongside it would
    // mean the new rules disagree with how these hands were actually played.
    //
    // It read 8 once before, for the opposite and wrong reason: ungraded hands
    // were counted as graded and, producing no violation, scored as correct.
    // That bug inflated accuracy. This does not — `charted` now counts only
    // decisions a node genuinely covers.
    expect(stats.charted).toBe(8);
    expect(stats.mistakes).toBe(2);
    expect(stats.accuracy).toBe(75);
  });
});

describe("the honesty check", () => {
  /**
   * The same file with the loose opens replaced by hands the chart opens, and
   * the folded blind defences replaced by hands the chart folds — the same
   * actions, now played correctly.
   */
  const CORRECT = SAMPLE.replace(
    /Dealt to Hero \[Kd 3s\]/,
    "Dealt to Hero [Ah Ks]",
  )
    .replace(/Dealt to Hero \[Jc 8d\]/, "Dealt to Hero [Ac Qd]")
    .replace(/Dealt to Hero \[Th 7c\]/, "Dealt to Hero [Ad Kd]")
    .replace(/Dealt to Hero \[Qh 9c\]/, "Dealt to Hero [7h 2c]")
    .replace(/Dealt to Hero \[Kc 9d\]/, "Dealt to Hero [8c 2d]")
    .replace(/Dealt to Hero \[Jd 9s\]/, "Dealt to Hero [9d 2s]");

  it("finds nothing in hands played correctly", () => {
    const out = run(CORRECT);

    expect(out.hands).toHaveLength(8);
    expect(out.violations).toEqual([]);
    expect(out.leaks).toEqual([]);
    expect(out.targets).toEqual([]);
  });
});
