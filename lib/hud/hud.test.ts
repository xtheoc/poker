import { describe, expect, it } from "vitest";
import { dealHud, fitScores } from "./deal";
import {
  GRADED_STATS,
  PLAYER_TYPES,
  type PlayerTypeId,
  rangeFor,
} from "./players";
import {
  BLIND_PFR_AT,
  BLIND_VPIP_AT,
  STATS,
  type StatId,
  type TableFormat,
  bandLabels,
  blindedAt,
  colourOf,
  visibleStats,
} from "./stats";

const FORMATS: TableFormat[] = ["6max", "fullring"];

/** A deterministic generator, so a failure can be reproduced exactly. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // xorshift32. Not cryptographic, and does not need to be.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

describe("colour bands", () => {
  it("puts a value on the boundary in the lower band", () => {
    // Read off the cuts rather than typed out. These numbers are the reader's
    // own HM3 configuration and have already moved once; a test restating them
    // is a third copy to keep in sync, and it fails for the wrong reason when
    // the real ones change.
    const [green, yellow] = STATS.vpip.cuts["6max"];

    expect(colourOf("vpip", green, "6max")).toBe("green");
    expect(colourOf("vpip", green + 1, "6max")).toBe("yellow");
    expect(colourOf("vpip", yellow, "6max")).toBe("yellow");
    expect(colourOf("vpip", yellow + 1, "6max")).toBe("red");
  });

  it("uses the full-ring bands when asked", () => {
    // The same VPIP is looser nine-handed than six-handed, so a value between
    // the two green ceilings has to colour differently in each.
    const sixMax = STATS.vpip.cuts["6max"][0];
    const fullRing = STATS.vpip.cuts.fullring[0];
    expect(fullRing).toBeLessThan(sixMax);

    const between = fullRing + 1;
    expect(colourOf("vpip", between, "fullring")).toBe("yellow");
    expect(colourOf("vpip", between, "6max")).toBe("green");
  });

  it("colours the aggression factor on the displayed number", () => {
    // Grading the raw value would mark you wrong for reading what is on
    // screen: a number just under the cut still *prints* as the cut.
    const [green, yellow] = STATS.agg.cuts["6max"];

    expect(colourOf("agg", green, "6max")).toBe("green");
    expect(colourOf("agg", green + 0.04, "6max")).toBe("green");
    // Rounds up across the boundary, so it shows a yellow number and must be
    // graded as one.
    expect(colourOf("agg", green + 0.06, "6max")).toBe("yellow");
    expect(colourOf("agg", yellow + 0.01, "6max")).toBe("yellow");
    expect(colourOf("agg", yellow + 0.1, "6max")).toBe("red");
  });
});

describe("the printed bands", () => {
  it("writes the bands exactly as the ranges were given", () => {
    // The reader's own HM3 bands, transcribed in lib/hud/stats.ts. Spelled out
    // here on purpose — this one test is the place a typo in those numbers
    // gets caught, so deriving it from the same constants would defeat it.
    expect(bandLabels("vpip", "6max")).toEqual({
      green: "0–24",
      yellow: "25–40",
      red: "41+",
    });
    expect(bandLabels("pfr", "6max")).toEqual({
      green: "0–15",
      yellow: "16–24",
      red: "25+",
    });
    expect(bandLabels("vpip", "fullring")).toEqual({
      green: "0–18",
      yellow: "19–35",
      red: "36+",
    });
    expect(bandLabels("flopFoldCb", "6max")).toEqual({
      green: "0–59",
      yellow: "60–69",
      red: "70+",
    });
    expect(bandLabels("flopCb", "6max")).toEqual({
      green: "0–49",
      yellow: "50–74",
      red: "75+",
    });
    expect(bandLabels("foldThreeBet", "6max")).toEqual({
      green: "0–54",
      yellow: "55–69",
      red: "70+",
    });
  });

  it("steps by a tenth on the stats written to one decimal", () => {
    // Printing "0–1 / 2–4" here would be wrong twice over: the wrong
    // precision, and a yellow band that looks like it starts at 2 rather than
    // 1.5. The zero stays bare, exactly as the source writes it.
    expect(bandLabels("agg", "6max")).toEqual({
      green: "0–1.4",
      yellow: "1.5–4.4",
      red: "4.5+",
    });
    // 3-bet carries a decimal for one reason: its bands are stated to one, and
    // rounded to whole numbers the top of green and the bottom of yellow would
    // print as the same value.
    expect(bandLabels("threeBet", "6max")).toEqual({
      green: "0–2.9",
      yellow: "3.0–6.9",
      red: "7.0+",
    });
  });

  it("agrees with the grader at every boundary", () => {
    // The reference card and the colouring must not be able to drift apart.
    for (const format of FORMATS) {
      for (const id of Object.keys(STATS) as StatId[]) {
        const [green, yellow] = STATS[id].cuts[format];
        const step = STATS[id].decimals === 1 ? 0.1 : 1;

        expect(colourOf(id, green, format), `${id} ${format}`).toBe("green");
        expect(colourOf(id, green + step, format), `${id} ${format}`).toBe(
          "yellow",
        );
        expect(colourOf(id, yellow, format), `${id} ${format}`).toBe("yellow");
        expect(colourOf(id, yellow + step, format), `${id} ${format}`).toBe(
          "red",
        );
      }
    }
  });
});

describe("sample-size gating", () => {
  it("shows only VPIP and PFR below 100 hands", () => {
    expect(visibleStats(60)).toEqual(["vpip", "pfr"]);
  });

  it("adds the flop and preflop stats at 100", () => {
    const visible = visibleStats(120);
    expect(visible).toContain("agg");
    expect(visible).toContain("flopCb");
    expect(visible).toContain("threeBet");
    expect(visible).not.toContain("turnCb");
  });

  it("adds the turn stats at 500", () => {
    expect(visibleStats(500)).toContain("turnCb");
    expect(visibleStats(499)).not.toContain("turnCb");
  });

  it("shows nothing at all below the first tier", () => {
    expect(visibleStats(12)).toEqual([]);
  });
});

describe("taking the colours away", () => {
  it("shows every colour until the streak earns the first removal", () => {
    for (const streak of [0, 1, 12, 19]) {
      expect(blindedAt(streak), `streak ${streak}`).toEqual([]);
    }
  });

  it("greys the VPIP at twenty and the PFR at forty", () => {
    expect(blindedAt(BLIND_VPIP_AT)).toEqual(["vpip"]);
    expect(blindedAt(30)).toEqual(["vpip"]);
    expect(blindedAt(BLIND_PFR_AT)).toEqual(["vpip", "pfr"]);
    expect(blindedAt(120)).toEqual(["vpip", "pfr"]);
  });

  it("never takes the colour off a stat that is not decisive", () => {
    // Blinding the c-bet stats would just be hiding information. The point is
    // to remove the shortcut on the two numbers the read actually turns on.
    for (const streak of [20, 40, 500]) {
      for (const id of blindedAt(streak)) {
        expect(["vpip", "pfr"]).toContain(id);
      }
    }
  });
});

describe("the archetype ranges", () => {
  it("lands every range inside the colour its pattern claims", () => {
    // The assertion that keeps the answer key and the generator honest with
    // each other. If a range is edited into the wrong band, the drill would
    // silently start teaching a shape the source never described.
    for (const format of FORMATS) {
      for (const type of PLAYER_TYPES) {
        for (const stat of GRADED_STATS) {
          const want = type.pattern[stat];
          const range = rangeFor(type, stat, format);
          if (!want || !range) continue;

          for (const value of range) {
            expect(
              colourOf(stat, value, format),
              `${type.id}/${format}/${stat} = ${value}`,
            ).toBe(want);
          }
        }
      }
    }
  });

  it("gives all five types a distinct VPIP/PFR colour pair", () => {
    // This is what makes a 60-hand read possible at all. Lose it and the
    // low-sample tier becomes unanswerable rather than merely hard.
    const pairs = PLAYER_TYPES.map((t) => `${t.pattern.vpip}/${t.pattern.pfr}`);
    expect(new Set(pairs).size).toBe(PLAYER_TYPES.length);
  });

  it("never raises more often than it enters a pot", () => {
    for (const type of PLAYER_TYPES) {
      for (const format of FORMATS) {
        const vpip = rangeFor(type, "vpip", format);
        const pfr = rangeFor(type, "pfr", format);
        if (!vpip || !pfr) continue;
        // The top of the PFR range must be reachable under the top of VPIP, or
        // the dealer would have to clamp PFR out of its own colour band.
        expect(pfr[1], `${type.id}/${format}`).toBeLessThanOrEqual(vpip[1]);
      }
    }
  });
});

describe("dealing a player", () => {
  it("shows a HUD matching the sample size it rolled", () => {
    for (let seed = 1; seed < 300; seed++) {
      const read = dealHud({ rng: seeded(seed) });
      const expected = visibleStats(read.hands);
      expect(Object.keys(read.values).sort()).toEqual([...expected].sort());
    }
  });

  it("never shows a PFR above its VPIP", () => {
    for (let seed = 1; seed < 500; seed++) {
      const read = dealHud({ rng: seeded(seed) });
      if (read.values.vpip === undefined || read.values.pfr === undefined) {
        continue;
      }
      expect(read.values.pfr, `seed ${seed}`).toBeLessThanOrEqual(
        read.values.vpip,
      );
    }
  });

  it("keeps the dealt type the single best fit, noise and all", () => {
    // The drill would be broken rather than hard if a knocked stat could make
    // another archetype explain the HUD better than the true one.
    for (const format of FORMATS) {
      for (let seed = 1; seed < 600; seed++) {
        const read = dealHud({ rng: seeded(seed), format });
        const scores = fitScores(read);
        expect(scores[0].type, `seed ${seed} ${format}`).toBe(read.type);
        expect(
          scores[0].matched,
          `seed ${seed} ${format} tied with ${scores[1].type}`,
        ).toBeGreaterThan(scores[1].matched);
      }
    }
  });

  it("still produces the ungraded turn stats at a big sample", () => {
    // They have no pattern row, but they must render rather than crash.
    let checked = 0;
    for (let seed = 1; seed < 400; seed++) {
      const read = dealHud({ rng: seeded(seed) });
      if (read.hands < 500) continue;
      expect(read.values.turnCb).toBeDefined();
      expect(read.values.turnFoldCb).toBeDefined();
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("deals a requested type", () => {
    for (const type of PLAYER_TYPES) {
      expect(dealHud({ type: type.id, rng: seeded(7) }).type).toBe(type.id);
    }
  });

  it("only ever knocks one stat, and never a decisive one", () => {
    for (let seed = 1; seed < 500; seed++) {
      const read = dealHud({ rng: seeded(seed) });
      if (!read.odd) continue;
      expect(["vpip", "pfr"]).not.toContain(read.odd);
      expect(GRADED_STATS).toContain(read.odd);
    }
  });

  it("produces both off-pattern deals and clean ones", () => {
    // Both branches have to actually happen or half the drill is untested.
    const odds: boolean[] = [];
    for (let seed = 1; seed < 300; seed++) {
      const read = dealHud({ rng: seeded(seed) });
      if (visibleStats(read.hands).length > 2) odds.push(read.odd !== null);
    }
    expect(odds.some(Boolean)).toBe(true);
    expect(odds.some((odd) => !odd)).toBe(true);
  });

  it("stays fair and legal at full difficulty", () => {
    // Everything the easy deals guarantee must survive the hard ones, or
    // "harder" would just mean "sometimes wrong".
    for (const format of FORMATS) {
      for (let seed = 1; seed < 600; seed++) {
        const read = dealHud({ rng: seeded(seed), format, difficulty: 1 });

        const scores = fitScores(read);
        expect(scores[0].type, `seed ${seed} ${format}`).toBe(read.type);
        expect(
          scores[0].matched,
          `seed ${seed} ${format} tied with ${scores[1].type}`,
        ).toBeGreaterThan(scores[1].matched);

        if (read.values.vpip !== undefined && read.values.pfr !== undefined) {
          expect(read.values.pfr, `seed ${seed}`).toBeLessThanOrEqual(
            read.values.vpip,
          );
        }
      }
    }
  });

  it("keeps every stat but the knocked one on its archetype colour", () => {
    // Borderline values sit at the edge of the right band, never over it. If
    // clamping VPIP up past the PFR pushed it into the next band, the drill
    // would show one type and grade another.
    for (const difficulty of [0, 0.5, 1]) {
      for (let seed = 1; seed < 400; seed++) {
        const read = dealHud({ rng: seeded(seed), difficulty });
        const type = PLAYER_TYPES.find((t) => t.id === read.type);
        if (!type) throw new Error("unknown type");

        for (const id of GRADED_STATS) {
          const value = read.values[id];
          if (value === undefined || id === read.odd) continue;
          expect(
            colourOf(id, value, read.format),
            `d=${difficulty} seed ${seed} ${read.type}/${id} = ${value}`,
          ).toBe(type.pattern[id]);
        }
      }
    }
  });

  it("actually pushes numbers to the edges when asked", () => {
    // The point of the setting. A 6-max nit's VPIP band tops out at 22 and its
    // comfortable range stops at 19, so anything above 19 could only have come
    // from the borderline path.
    let edgy = 0;
    for (let seed = 1; seed < 400; seed++) {
      const read = dealHud({ rng: seeded(seed), difficulty: 1, type: "nit" });
      if ((read.values.vpip ?? 0) > 19) edgy++;
    }
    expect(edgy).toBeGreaterThan(0);
  });

  it("leaves the easy deals easy when difficulty is zero", () => {
    // At difficulty zero a nit's VPIP must still *read* green, which is a
    // weaker claim than staying inside the archetype's tidy range — one stat
    // per deal can be knocked off its anchor even here, and that is intended.
    // What must not happen is the knock carrying it into another colour, which
    // would make the spot unanswerable at the easiest setting.
    //
    // Read off the cut rather than typed: this bound moved when the reader
    // reconfigured his HUD, and a constant here would have failed for a reason
    // that had nothing to do with dealing.
    const top = STATS.vpip.cuts["6max"][0];

    for (let seed = 1; seed < 300; seed++) {
      const read = dealHud({ rng: seeded(seed), type: "nit" });
      const vpip = read.values.vpip;
      if (vpip === undefined) continue;
      expect(vpip, `seed ${seed}`).toBeLessThanOrEqual(top);
    }
  });

  it("reaches every player type over enough deals", () => {
    const seen = new Set<PlayerTypeId>();
    for (let seed = 1; seed < 400; seed++) {
      seen.add(dealHud({ rng: seeded(seed) }).type);
    }
    expect(seen.size).toBe(PLAYER_TYPES.length);
  });
});
