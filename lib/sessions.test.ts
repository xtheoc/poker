import { describe, expect, it } from "vitest";
import {
  STAT_THRESHOLDS,
  type SessionHand,
  accuracyTrend,
  groupSessions,
  groupWeeks,
  resultsByPosition,
  sessionContaining,
  statsFor,
} from "./sessions";

function at(iso: string, over: Partial<SessionHand> = {}): SessionHand {
  return {
    psHandId: iso,
    playedAt: new Date(iso),
    netBb: 0,
    vpip: false,
    pfr: false,
    sawFlop: false,
    wentToShowdown: false,
    wonAtShowdown: false,
    won: false,
    chartedDecisions: 0,
    mistakes: 0,
    position: null,
    ...over,
  };
}

describe("splitting hands into sittings", () => {
  it("keeps hands minutes apart in one sitting", () => {
    const sessions = groupSessions([
      at("2026-01-15T20:00:00Z"),
      at("2026-01-15T20:20:00Z"),
      at("2026-01-15T20:55:00Z"),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].hands).toHaveLength(3);
  });

  it("starts a new sitting after an hour away", () => {
    const sessions = groupSessions([
      at("2026-01-15T14:00:00Z"),
      at("2026-01-15T20:00:00Z"),
      at("2026-01-15T20:10:00Z"),
    ]);

    expect(sessions).toHaveLength(2);
    // Newest sitting first, because that is the one just played.
    expect(sessions[0].hands).toHaveLength(2);
    expect(sessions[1].hands).toHaveLength(1);
  });

  it("names a sitting after its first hand, and finds it by any hand in it", () => {
    const sessions = groupSessions([
      at("2026-01-15T20:00:00Z"),
      at("2026-01-15T20:10:00Z"),
    ]);

    expect(sessions[0].id).toBe("2026-01-15T20:00:00Z");
    expect(sessionContaining(sessions, "2026-01-15T20:10:00Z")?.id).toBe(
      "2026-01-15T20:00:00Z",
    );
    expect(sessionContaining(sessions, "nonsense")).toBeUndefined();
  });

  it("groups correctly however the hands arrive", () => {
    // An import hands these over newest-first; the grouping must not care.
    const sessions = groupSessions([
      at("2026-01-15T20:10:00Z"),
      at("2026-01-15T14:00:00Z"),
      at("2026-01-15T20:00:00Z"),
    ]);

    expect(sessions.map((s) => s.hands.length)).toEqual([2, 1]);
  });
});

describe("grouping sittings into weeks", () => {
  it("puts a Monday and the Sunday after it in the same week", () => {
    // Sunday ends a week rather than starting one. Getting that wrong splits a
    // weekend across two rows.
    const weeks = groupWeeks(
      groupSessions([
        at("2026-09-07T20:00:00Z"), // Monday
        at("2026-09-13T20:00:00Z"), // Sunday
      ]),
    );

    expect(weeks).toHaveLength(1);
    expect(weeks[0].sessions).toHaveLength(2);
  });

  it("starts a new week on the following Monday", () => {
    const weeks = groupWeeks(
      groupSessions([
        at("2026-09-13T20:00:00Z"), // Sunday
        at("2026-09-14T20:00:00Z"), // Monday
      ]),
    );

    expect(weeks).toHaveLength(2);
  });

  it("returns the newest week first", () => {
    const weeks = groupWeeks(
      groupSessions([at("2026-09-01T20:00:00Z"), at("2026-09-14T20:00:00Z")]),
    );

    expect(weeks[0].startedAt.getTime()).toBeGreaterThan(
      weeks[1].startedAt.getTime(),
    );
  });
});

describe("the accuracy trend", () => {
  it("reports one point per sitting, oldest first", () => {
    const trend = accuracyTrend(
      groupSessions([
        at("2026-09-14T20:00:00Z", { chartedDecisions: 2, mistakes: 1 }),
        at("2026-09-01T20:00:00Z", { chartedDecisions: 4 }),
      ]),
    );

    expect(trend).toHaveLength(2);
    expect(trend[0].accuracy).toBe(100);
    expect(trend[1].accuracy).toBe(50);
  });

  it("drops a sitting with nothing gradeable rather than scoring it zero", () => {
    // An evening of limped pots is not an evening where you played badly, and
    // plotting it at zero would invent a slump.
    const trend = accuracyTrend(
      groupSessions([
        at("2026-09-01T20:00:00Z", { chartedDecisions: 2 }),
        at("2026-09-08T20:00:00Z"),
      ]),
    );

    expect(trend).toHaveLength(1);
    expect(trend[0].accuracy).toBe(100);
  });
});

describe("results by position", () => {
  it("puts the seat that lost most money first", () => {
    const results = resultsByPosition([
      at("2026-01-15T20:00:00Z", { position: "BTN", netBb: 8 }),
      at("2026-01-15T20:05:00Z", { position: "SB", netBb: -12 }),
      at("2026-01-15T20:10:00Z", { position: "BB", netBb: -3 }),
    ]);

    expect(results.map((r) => r.position)).toEqual(["SB", "BB", "BTN"]);
    expect(results[0].netBb).toBe(-12);
  });

  it("adds up every hand from a seat", () => {
    const results = resultsByPosition([
      at("2026-01-15T20:00:00Z", { position: "SB", netBb: -4 }),
      at("2026-01-15T20:05:00Z", { position: "SB", netBb: -6 }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].hands).toBe(2);
    expect(results[0].netBb).toBe(-10);
    expect(results[0].bbPer100).toBe(-500);
  });

  it("calls a small sample unreliable", () => {
    // The whole point of the field. A seat that has lost 12bb over three hands
    // has told you nothing, and a red number that large implies otherwise.
    const results = resultsByPosition([
      at("2026-01-15T20:00:00Z", { position: "SB", netBb: -12 }),
    ]);

    expect(results[0].reliable).toBe(false);
  });

  it("grades accuracy per seat without any sample gate", () => {
    // Unlike the money: each decision was inside the range or outside it, so
    // this means something from the first hand.
    const results = resultsByPosition([
      at("2026-01-15T20:00:00Z", {
        position: "SB",
        chartedDecisions: 2,
        mistakes: 1,
      }),
      at("2026-01-15T20:05:00Z", { position: "SB", chartedDecisions: 2 }),
    ]);

    expect(results[0].charted).toBe(4);
    expect(results[0].mistakes).toBe(1);
    expect(results[0].accuracy).toBe(75);
  });

  it("skips hands with no position rather than inventing a seat", () => {
    const results = resultsByPosition([
      at("2026-01-15T20:00:00Z", { netBb: -50 }),
      at("2026-01-15T20:05:00Z", { position: "BTN", netBb: 1 }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].position).toBe("BTN");
  });

  it("omits seats never played instead of showing them as breakeven", () => {
    // A zero row reads as "I break even here", which is a claim about a seat
    // there is no evidence about at all.
    const results = resultsByPosition([
      at("2026-01-15T20:00:00Z", { position: "BTN", netBb: 2 }),
    ]);

    expect(results.map((r) => r.position)).toEqual(["BTN"]);
  });
});

describe("session statistics", () => {
  it("reports a win rate in big blinds per hundred hands", () => {
    const stats = statsFor([
      at("2026-01-15T20:00:00Z", { netBb: 10 }),
      at("2026-01-15T20:05:00Z", { netBb: -4 }),
      at("2026-01-15T20:10:00Z", { netBb: -1 }),
      at("2026-01-15T20:15:00Z", { netBb: 0 }),
    ]);

    expect(stats.netBb).toBe(5);
    expect(stats.bbPer100).toBe(125);
    expect(stats.minutes).toBe(15);
  });

  it("grades preflop accuracy without any sample gate", () => {
    const stats = statsFor([
      at("2026-01-15T20:00:00Z", { chartedDecisions: 1, mistakes: 1 }),
      at("2026-01-15T20:05:00Z", { chartedDecisions: 1 }),
      at("2026-01-15T20:10:00Z", { chartedDecisions: 1 }),
      at("2026-01-15T20:15:00Z", { chartedDecisions: 1 }),
    ]);

    // Each decision was either inside the chart's range or it was not. That is
    // a fact about four decisions, not an estimate from a sample of four.
    expect(stats.charted).toBe(4);
    expect(stats.mistakes).toBe(1);
    expect(stats.accuracy).toBe(75);
  });

  it("marks a stat unreliable until its sample is big enough", () => {
    const hands = Array.from({ length: 50 }, (_, i) =>
      at(`2026-01-15T20:${String(i).padStart(2, "0")}:00Z`, { vpip: i < 10 }),
    );
    const stats = statsFor(hands);

    expect(stats.vpip.value).toBe(20);
    expect(stats.vpip.samples).toBe(50);
    expect(stats.vpip.threshold).toBe(STAT_THRESHOLDS.vpip);
    // True about this session, and silent about the player.
    expect(stats.vpip.reliable).toBe(false);
  });

  it("denominates the showdown stats in flops seen, not hands dealt", () => {
    const stats = statsFor([
      at("2026-01-15T20:00:00Z", { sawFlop: true, won: true }),
      at("2026-01-15T20:05:00Z", {
        sawFlop: true,
        wentToShowdown: true,
        wonAtShowdown: true,
        won: true,
      }),
      at("2026-01-15T20:10:00Z", { sawFlop: true }),
      // Folded preflop: outside every one of these denominators.
      at("2026-01-15T20:15:00Z"),
    ]);

    expect(stats.wwsf.samples).toBe(3);
    expect(stats.wwsf.value).toBeCloseTo(66.67, 1);
    expect(stats.wtsd.samples).toBe(3);
    expect(stats.wsd.samples).toBe(1);
    expect(stats.wsd.value).toBe(100);
  });

  it("reports zeroes rather than dividing by nothing", () => {
    const stats = statsFor([]);

    expect(stats.hands).toBe(0);
    expect(stats.bbPer100).toBe(0);
    expect(stats.accuracy).toBe(0);
    expect(stats.wwsf.value).toBe(0);
  });
});
