/**
 * The HUD stats, and the colour each number wears.
 *
 * These are *opponent* statistics, which makes them a different thing from the
 * ones in `lib/sessions.ts` despite sharing names. Those describe you and are
 * gated at the sample where they become a trustworthy estimate — 300 hands for
 * VPIP, 8,000 for the showdown family. These describe a stranger you have to
 * act against in four seconds, and the honest threshold is far lower, because
 * the alternative is not "wait for more data", it is "guess with nothing".
 *
 * Both are right for their own question. Neither should be used for the other's.
 *
 * The bands run the same direction on every stat — green is a low number, red
 * is a high one — which is the whole reason a HUD can be read as a shape rather
 * than as nine separate numbers. Green does not mean bad player and red does
 * not mean good one: a maniac is red nearly everywhere and is the best seat at
 * the table.
 */

export type HudColour = "green" | "yellow" | "red";

/** Table size. The bands for the preflop stats differ between them. */
export type TableFormat = "6max" | "fullring";

export type StatId =
  | "vpip"
  | "pfr"
  | "agg"
  | "flopFoldCb"
  | "turnFoldCb"
  | "flopCb"
  | "turnCb"
  | "threeBet"
  | "foldThreeBet";

export interface StatDef {
  id: StatId;
  /** As it reads on the HUD. */
  label: string;
  decimals: 0 | 1;
  /**
   * Upper bound of green, then of yellow. Red is everything above.
   *
   * Two cuts rather than three ranges because the bands must touch without
   * overlapping — expressing that as separate ranges invites a gap where a
   * value has no colour at all.
   */
  cuts: Record<TableFormat, [number, number]>;
  /** Realistic bounds, used when inventing a number of a given colour. */
  realistic: [number, number];
}

/** Same cuts whatever the table size. */
function both(
  green: number,
  yellow: number,
): Record<TableFormat, [number, number]> {
  return { "6max": [green, yellow], fullring: [green, yellow] };
}

/**
 * The cuts are the reader's own HUD configuration, not our estimate of it.
 *
 * They began as our estimates. The playbook later stated a different set, and
 * for a while the two disagreed — the sheet called a 60% fold-to-cbet yellow
 * while the drill coloured it red. He has since set HM3 to the playbook's
 * numbers and confirmed those are the right ones, so these are a transcription
 * of what his tracker actually paints.
 *
 * That is the only defensible source. A drill teaching you to read colours your
 * own HUD does not show is training the wrong reflex, and the drill is the
 * thing that has to move.
 *
 * Turn fold-to-cbet and turn cbet keep our estimates: the playbook states no
 * bands for them, and manufacturing agreement would be worse than admitting
 * they come from somewhere else.
 */
export const STATS: Record<StatId, StatDef> = {
  vpip: {
    id: "vpip",
    label: "VPIP",
    decimals: 0,
    cuts: { "6max": [24, 40], fullring: [18, 35] },
    realistic: [6, 95],
  },
  pfr: {
    id: "pfr",
    label: "PFR",
    decimals: 0,
    cuts: { "6max": [15, 24], fullring: [9, 17] },
    realistic: [1, 85],
  },
  agg: {
    id: "agg",
    label: "Agg",
    decimals: 1,
    cuts: both(1.4, 4.4),
    realistic: [0.4, 8],
  },
  flopFoldCb: {
    id: "flopFoldCb",
    label: "Flop Fold to CB",
    decimals: 0,
    cuts: both(59, 69),
    realistic: [12, 88],
  },
  turnFoldCb: {
    id: "turnFoldCb",
    label: "Turn Fold to CB",
    decimals: 0,
    cuts: both(45, 60),
    realistic: [15, 90],
  },
  flopCb: {
    id: "flopCb",
    label: "Flop CB",
    decimals: 0,
    cuts: both(49, 74),
    realistic: [25, 95],
  },
  turnCb: {
    id: "turnCb",
    label: "Turn CB",
    decimals: 0,
    cuts: both(35, 55),
    realistic: [12, 90],
  },
  threeBet: {
    id: "threeBet",
    label: "3Bet",
    // One decimal, because the bands are stated to one: green stops at 2.9 and
    // yellow starts at 3.0. Rounded to whole numbers those two would display
    // as the same value and the boundary would be unreadable.
    decimals: 1,
    cuts: both(2.9, 6.9),
    realistic: [0, 30],
  },
  foldThreeBet: {
    id: "foldThreeBet",
    label: "Fold to 3Bet",
    decimals: 0,
    cuts: both(54, 69),
    realistic: [15, 92],
  },
};

/**
 * The HUD, laid out as it sits on screen.
 *
 * Three rows, matching HM3. Hands closes the last row because it is not a
 * tendency and carries no colour — it is the thing that says how much of the
 * rest to believe.
 */
export const HUD_ROWS: ReadonlyArray<readonly StatId[]> = [
  ["vpip", "pfr", "agg"],
  ["flopFoldCb", "turnFoldCb", "flopCb", "turnCb"],
  ["threeBet", "foldThreeBet"],
];

/**
 * How many hands before a stat is worth showing at all.
 *
 * Not the stabilisation points from the research — those answer "when is this a
 * reliable estimate", and by that standard you would read nothing about anybody
 * all session. These are the practical thresholds: the sample at which acting
 * on the number beats acting on nothing.
 *
 * VPIP and PFR arrive first and nearly free, which is why the two-stat read
 * matters so much, and why the drill makes you do it alone before it hands you
 * anything else.
 */
export const TIERS: ReadonlyArray<{
  minHands: number;
  stats: readonly StatId[];
}> = [
  { minHands: 20, stats: ["vpip", "pfr"] },
  {
    minHands: 100,
    stats: ["agg", "flopCb", "flopFoldCb", "threeBet", "foldThreeBet"],
  },
  { minHands: 500, stats: ["turnCb", "turnFoldCb"] },
];

/** Which stats a sample of this size supports, in HUD order. */
export function visibleStats(hands: number): StatId[] {
  const unlocked = new Set<StatId>();
  for (const tier of TIERS) {
    if (hands >= tier.minHands) for (const id of tier.stats) unlocked.add(id);
  }
  return HUD_ROWS.flat().filter((id) => unlocked.has(id));
}

/**
 * Streaks at which the colours start coming off in the drill.
 *
 * Past twenty the VPIP prints grey; past forty the PFR joins it. The numbers
 * stay, so nothing is hidden — what goes is the shortcut. Once the two stats
 * the whole read turns on have no colour, you are measuring them against bands
 * you remember rather than matching hues, which is the difference between
 * knowing the ranges and knowing which colours sit next to each other.
 *
 * In that order because that is the order they matter: VPIP is the first number
 * anyone looks at, so it is the first crutch worth removing.
 */
export const BLIND_VPIP_AT = 20;
export const BLIND_PFR_AT = 40;

/** Which stats print without colour at a given streak. */
export function blindedAt(streak: number): StatId[] {
  const blinded: StatId[] = [];
  if (streak >= BLIND_VPIP_AT) blinded.push("vpip");
  if (streak >= BLIND_PFR_AT) blinded.push("pfr");
  return blinded;
}

/** Round the way the HUD displays it, so comparisons match what is on screen. */
export function displayed(stat: StatDef, value: number): number {
  const factor = stat.decimals === 1 ? 10 : 1;
  return Math.round(value * factor) / factor;
}

/**
 * The three bands written out, for a reference table.
 *
 * Derived from the cuts rather than typed out a second time. Two copies of
 * these numbers is how a reference card ends up quietly disagreeing with the
 * grader — you would read "23–33" while a 33 came up red.
 *
 * The step matters: bands touch without overlapping, so yellow starts one
 * increment above green, and that increment is 0.1 on the aggression factor
 * and 1 everywhere else.
 */
export function bandLabels(
  id: StatId,
  format: TableFormat,
): Record<HudColour, string> {
  const stat = STATS[id];
  const [green, yellow] = stat.cuts[format];
  const step = stat.decimals === 1 ? 0.1 : 1;
  const show = (value: number) => value.toFixed(stat.decimals);

  return {
    green: `0–${show(green)}`,
    yellow: `${show(green + step)}–${show(yellow)}`,
    red: `${show(yellow + step)}+`,
  };
}

/**
 * The colour a value wears.
 *
 * Compares the *displayed* number rather than the raw one. A 1.96 that prints
 * as "2.0" must be yellow, or the drill shows a yellow-looking number and marks
 * you wrong for reading it as yellow.
 */
export function colourOf(
  id: StatId,
  value: number,
  format: TableFormat,
): HudColour {
  const stat = STATS[id];
  const [green, yellow] = stat.cuts[format];
  const shown = displayed(stat, value);

  if (shown <= green) return "green";
  if (shown <= yellow) return "yellow";
  return "red";
}
