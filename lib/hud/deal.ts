/**
 * Inventing a player to read.
 *
 * Three things have to be true of a dealt HUD or the drill teaches the wrong
 * lesson.
 *
 * **The numbers must be believable.** Sampled from the type's own realistic
 * range rather than from the whole colour band, so a nit's VPIP lands near 16
 * and not on 2.
 *
 * **The sample size must do real work.** It is rolled first and it decides how
 * much of the HUD you get. At sixty hands you see VPIP and PFR and nothing
 * else, and you still have to answer — which is the actual table situation the
 * drill exists for, and the reason the five types were checked for distinct
 * VPIP/PFR colour pairs.
 *
 * **It must sometimes not fit perfectly.** A real HUD rarely matches an
 * archetype on all seven stats, and a drill where the pattern always matches
 * trains pattern-matching rather than judgement. So one stat is often knocked
 * into a neighbouring colour.
 *
 * That last one carries a risk worth naming: noise that changed the *right
 * answer* would be a drill marking you wrong for being right. So the knock
 * never touches VPIP or PFR — the pair that uniquely identifies all five types
 * — and never moves more than one stat. A test asserts the dealt type stays the
 * unique best fit across thousands of deals.
 */

import {
  GRADED_STATS,
  PLAYER_TYPES,
  type PlayerType,
  type PlayerTypeId,
  rangeFor,
} from "./players";
import {
  type HudColour,
  STATS,
  type StatId,
  type TableFormat,
  colourOf,
  displayed,
  visibleStats,
} from "./stats";

export interface HudRead {
  /** The truth. What the drill is asking you to name. */
  type: PlayerTypeId;
  format: TableFormat;
  hands: number;
  /** Only the stats this sample size supports. */
  values: Partial<Record<StatId, number>>;
  /** The stat knocked off-pattern, when one was. */
  odd: StatId | null;
}

/**
 * How often a deal carries an off-pattern stat.
 *
 * High enough that a clean pattern cannot be assumed, low enough that the
 * archetypes stay learnable. Only applies once there is a stat safe to knock —
 * below 100 hands the HUD is VPIP and PFR, and both are off limits.
 */
const ODD_CHANCE = 0.35;

/** The two stats the read ultimately rests on. Never perturbed. */
const DECISIVE: readonly StatId[] = ["vpip", "pfr"];

/** Sample sizes, weighted so every tier gets practised. */
const SAMPLES: ReadonlyArray<{ range: [number, number]; weight: number }> = [
  { range: [20, 99], weight: 0.35 },
  { range: [100, 499], weight: 0.45 },
  { range: [500, 900], weight: 0.2 },
];

function between(low: number, high: number, rng: () => number): number {
  return low + rng() * (high - low);
}

/** A believable value of a given colour, when no type range says otherwise. */
function inColour(
  id: StatId,
  colour: HudColour,
  format: TableFormat,
  rng: () => number,
): number {
  const stat = STATS[id];
  const [green, yellow] = stat.cuts[format];
  const [floor, ceiling] = stat.realistic;
  const step = stat.decimals === 1 ? 0.1 : 1;

  if (colour === "green") return between(floor, Math.min(green, ceiling), rng);
  if (colour === "yellow") {
    return between(
      Math.max(floor, green + step),
      Math.min(yellow, ceiling),
      rng,
    );
  }
  return between(Math.max(floor, yellow + step), ceiling, rng);
}

/** The colour one step away, for knocking a stat off its pattern. */
function neighbour(colour: HudColour, rng: () => number): HudColour {
  if (colour === "green") return "yellow";
  if (colour === "red") return "yellow";
  return rng() < 0.5 ? "green" : "red";
}

/**
 * Share of a band counted as its edge.
 *
 * A fifth. Wide enough that borderline deals actually appear, narrow enough
 * that "borderline" still means what it says.
 */
const EDGE = 0.2;

/**
 * A value pressed up against the edge of its colour band.
 *
 * The honest way to make this harder. The archetype ranges sit comfortably
 * inside their bands — a 6-max nit's VPIP lands 13-19 when green runs to 22 —
 * so the colour is obvious without reading the number, and the whole read
 * collapses to glancing at two hues. Real players sit *on* the boundaries: a
 * 22/14 is a nit and a 23/8 is an SLP, one point apart and different types.
 *
 * The colour stays correct, so the answer stays exactly as determined as it
 * was. What changes is that you have to read the number against the range
 * rather than eyeball it — and, when the first two numbers are that close,
 * check the rest of the HUD to confirm. Which is the actual skill.
 */
function borderline(
  id: StatId,
  colour: HudColour,
  format: TableFormat,
  rng: () => number,
): number {
  const stat = STATS[id];
  const [green, yellow] = stat.cuts[format];
  const [floor, ceiling] = stat.realistic;
  const step = stat.decimals === 1 ? 0.1 : 1;

  const [low, high]: [number, number] =
    colour === "green"
      ? [floor, Math.min(green, ceiling)]
      : colour === "yellow"
        ? [Math.max(floor, green + step), Math.min(yellow, ceiling)]
        : [Math.max(floor, yellow + step), ceiling];

  if (high <= low) return low;

  const span = (high - low) * EDGE;
  // Green has no meaningful bottom edge — a 0 VPIP is not a hard read, it is
  // an absurd one — so green hugs its top, and red hugs its bottom for the
  // same reason. Yellow is squeezed from both sides and can go either way.
  if (colour === "green") return between(high - span, high, rng);
  if (colour === "red") return between(low, low + span, rng);
  return rng() < 0.5
    ? between(low, low + span, rng)
    : between(high - span, high, rng);
}

export interface DealOptions {
  format?: TableFormat;
  rng?: () => number;
  /** Force a type, for tests and for drilling one archetype. */
  type?: PlayerTypeId;
  /**
   * How hard to make it, 0 to 1.
   *
   * Turns up two things and neither of them changes the right answer: how
   * often a number sits on the edge of its band instead of in the middle, and
   * how often a stat is knocked off the archetype. At 0 this deals exactly
   * what it dealt before the setting existed.
   */
  difficulty?: number;
}

/** Deal one opponent. */
export function dealHud(options: DealOptions = {}): HudRead {
  const { format = "6max", rng = Math.random } = options;
  const difficulty = Math.min(1, Math.max(0, options.difficulty ?? 0));

  // At full difficulty most numbers hug a boundary, and the read stops being a
  // glance at two colours.
  const edgeChance = 0.1 + 0.65 * difficulty;

  const type: PlayerType = options.type
    ? (PLAYER_TYPES.find((t) => t.id === options.type) ?? PLAYER_TYPES[0])
    : PLAYER_TYPES[Math.floor(rng() * PLAYER_TYPES.length)];

  const hands = Math.round(rollSample(rng));
  const visible = visibleStats(hands);

  // Which stat, if any, gets knocked off pattern. Chosen before any value is
  // sampled, so the knocked stat is drawn from the wrong band directly rather
  // than sampled correctly and then edited.
  const knockable = visible.filter(
    (id) => GRADED_STATS.includes(id) && !DECISIVE.includes(id),
  );
  const odd =
    knockable.length > 0 && rng() < ODD_CHANCE + 0.2 * difficulty
      ? knockable[Math.floor(rng() * knockable.length)]
      : null;

  const values: Partial<Record<StatId, number>> = {};

  /** A value for a stat the archetype owns, borderline or comfortable. */
  const sample = (id: StatId, colour: HudColour): number => {
    if (rng() < edgeChance) return borderline(id, colour, format, rng);
    const range = rangeFor(type, id, format);
    return range
      ? between(range[0], range[1], rng)
      : inColour(id, colour, format, rng);
  };

  // PFR before VPIP, then VPIP from what is left above it. A player cannot
  // raise more often than they enter a pot, and a HUD showing otherwise is
  // instantly unreadable to anyone who plays.
  if (visible.includes("pfr") && type.pattern.pfr) {
    values.pfr = sample("pfr", type.pattern.pfr);
  }
  if (visible.includes("vpip") && type.pattern.vpip) {
    const wanted = sample("vpip", type.pattern.vpip);
    // Raising the VPIP to clear the PFR must not push it out of its band, or
    // the colour — and with it the answer — would silently change.
    const [green, yellow] = STATS.vpip.cuts[format];
    const ceiling =
      type.pattern.vpip === "green"
        ? green
        : type.pattern.vpip === "yellow"
          ? yellow
          : STATS.vpip.realistic[1];
    values.vpip = Math.min(Math.max(wanted, values.pfr ?? 0), ceiling);
  }

  for (const id of visible) {
    if (id === "vpip" || id === "pfr") continue;

    // The turn stats have no row in the source's pattern table, so they are
    // neither graded nor invented from nothing: they follow the flop tendency
    // they extend. Cosmetic until there are real criteria for them.
    if (id === "turnCb" || id === "turnFoldCb") {
      const from = id === "turnCb" ? "flopCb" : "flopFoldCb";
      const base = values[from];
      const colour = base !== undefined ? colourOf(from, base, format) : "yellow";
      values[id] = inColour(id, colour, format, rng);
      continue;
    }

    const want = type.pattern[id];
    if (!want) continue;

    if (id === odd) {
      const wrong = neighbour(want, rng);
      values[id] =
        rng() < edgeChance
          ? borderline(id, wrong, format, rng)
          : inColour(id, wrong, format, rng);
      continue;
    }

    values[id] = sample(id, want);
  }

  // Round once, here, so what gets graded is exactly what is displayed.
  for (const id of Object.keys(values) as StatId[]) {
    const value = values[id];
    if (value !== undefined) values[id] = displayed(STATS[id], value);
  }

  return { type: type.id, format, hands, values, odd };
}

function rollSample(rng: () => number): number {
  const roll = rng();
  let seen = 0;
  for (const band of SAMPLES) {
    seen += band.weight;
    if (roll <= seen) return between(band.range[0], band.range[1], rng);
  }
  const last = SAMPLES[SAMPLES.length - 1];
  return between(last.range[0], last.range[1], rng);
}

/**
 * How well each type explains what is on screen.
 *
 * Used for feedback rather than for grading — the dealt type is the answer, and
 * this says how close a wrong guess was. VPIP and PFR carry triple weight
 * because they are what the read actually turns on, and because at low sample
 * they are all there is.
 */
export function fitScores(read: HudRead): Array<{
  type: PlayerTypeId;
  matched: number;
  total: number;
}> {
  const visible = visibleStats(read.hands).filter((id) =>
    GRADED_STATS.includes(id),
  );

  return PLAYER_TYPES.map((type) => {
    let matched = 0;
    let total = 0;
    for (const id of visible) {
      const want = type.pattern[id];
      const value = read.values[id];
      if (!want || value === undefined) continue;
      const weight = DECISIVE.includes(id) ? 3 : 1;
      total += weight;
      if (colourOf(id, value, read.format) === want) matched += weight;
    }
    return { type: type.id, matched, total };
  }).sort((a, b) => b.matched - a.matched);
}
