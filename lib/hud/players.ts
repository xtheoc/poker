/**
 * The five player types, as colour patterns and as believable numbers.
 *
 * Two representations of the same thing, and the split is the point.
 *
 * **The pattern is the answer key.** Seven colours per type, taken from
 * *Crushing The Microstakes*. It is what the drill grades against, and it is
 * deliberately colours rather than numbers: a HUD is read as a shape, and the
 * skill being trained is seeing "green wall with one red at the end" before
 * reading a single digit.
 *
 * **The ranges are how a fake player is dealt.** Each is a realistic slice
 * *inside* the band its pattern colour demands, anchored on the book's own
 * typical lines — 16/14 for a 6-max nit, 21/18 for a TAG, 30/8 for an SLP.
 * Sampling the whole colour band instead would be simpler and would produce a
 * "nit" with a VPIP of 2, which trains nothing.
 *
 * A test asserts every range lands in the colour its pattern claims. That
 * assertion is what keeps the two representations honest with each other, and
 * it is why the numbers can be tuned later without silently teaching the wrong
 * shape.
 *
 * One discrepancy worth recording: the source's "quick separation rule" says a
 * TAG has a *red* PFR, while its own pattern table and its own typical line
 * (15/12 full ring, PFR 12 → yellow) both say yellow. The table and the anchor
 * agree, so yellow wins. With that reading the five types have five distinct
 * VPIP/PFR colour pairs, which is precisely why a 60-hand sample is readable.
 */

import type { HudColour, StatId, TableFormat } from "./stats";

export type PlayerTypeId = "nit" | "tag" | "slp" | "fish" | "maniac";

/** The seven stats the source gives a verdict on. Turn stats are not among them. */
export const GRADED_STATS: readonly StatId[] = [
  "vpip",
  "pfr",
  "agg",
  "threeBet",
  "foldThreeBet",
  "flopCb",
  "flopFoldCb",
];

type Ranges = Partial<Record<StatId, [number, number]>>;

export interface PlayerType {
  id: PlayerTypeId;
  label: string;
  /** The typical line the source quotes, for feedback after an answer. */
  anchor: Record<TableFormat, string>;
  /** What gives it away, in one line. Shown only after you have answered. */
  tell: string;
  /** The answer key: the colour each graded stat should wear. */
  pattern: Partial<Record<StatId, HudColour>>;
  /** Realistic 6-max values, inside the pattern's bands. */
  ranges: Ranges;
  /** Overrides where the full-ring bands differ. */
  fullring: Ranges;
}

export const PLAYER_TYPES: PlayerType[] = [
  {
    id: "nit",
    label: "Nit",
    anchor: { fullring: "10 / 8", "6max": "16 / 14" },
    tell: "A green wall with one red at the end. Everything low, and folds to c-bets constantly.",
    pattern: {
      vpip: "green",
      pfr: "green",
      agg: "green",
      threeBet: "green",
      foldThreeBet: "yellow",
      flopCb: "yellow",
      flopFoldCb: "red",
    },
    ranges: {
      vpip: [13, 19],
      pfr: [10, 14],
      agg: [1.0, 1.4],
      threeBet: [1.0, 2.9],
      foldThreeBet: [56, 68],
      flopCb: [55, 68],
      flopFoldCb: [71, 85],
    },
    fullring: {
      vpip: [8, 14],
      pfr: [5, 9],
      threeBet: [1.0, 2.9],
      foldThreeBet: [56, 68],
    },
  },
  {
    id: "tag",
    label: "TAG",
    anchor: { fullring: "15 / 12", "6max": "21 / 18" },
    tell: "The only type pairing a low VPIP with high aggression. Green on the left, red on the right. Avoid.",
    pattern: {
      vpip: "green",
      pfr: "yellow",
      agg: "red",
      threeBet: "red",
      foldThreeBet: "yellow",
      flopCb: "red",
      flopFoldCb: "red",
    },
    ranges: {
      vpip: [19, 23],
      pfr: [17, 23],
      agg: [4.6, 6.5],
      threeBet: [8.0, 13.0],
      foldThreeBet: [56, 68],
      flopCb: [76, 90],
      flopFoldCb: [71, 84],
    },
    fullring: {
      vpip: [13, 17],
      pfr: [10, 16],
      threeBet: [7.5, 11.0],
      foldThreeBet: [56, 68],
    },
  },
  {
    id: "slp",
    label: "SLP",
    anchor: { fullring: "24 / 6", "6max": "30 / 8" },
    tell: "Yellow and green only, no red anywhere. Nothing stands out, and that is the tell. Value bet him wide.",
    pattern: {
      vpip: "yellow",
      pfr: "green",
      agg: "green",
      threeBet: "green",
      foldThreeBet: "green",
      flopCb: "yellow",
      flopFoldCb: "yellow",
    },
    ranges: {
      vpip: [27, 35],
      pfr: [5, 11],
      agg: [0.8, 1.4],
      threeBet: [0.5, 2.8],
      foldThreeBet: [32, 48],
      flopCb: [52, 66],
      flopFoldCb: [60, 68],
    },
    fullring: {
      vpip: [21, 30],
      pfr: [4, 9],
      threeBet: [0.5, 2.8],
      foldThreeBet: [32, 48],
    },
  },
  {
    id: "fish",
    label: "Fish",
    anchor: { fullring: "55 / 4", "6max": "55 / 4" },
    tell: "One red at the front, green all the way behind it. Plays everything, does nothing with it. Your main source of profit.",
    pattern: {
      vpip: "red",
      pfr: "green",
      agg: "green",
      threeBet: "green",
      foldThreeBet: "green",
      flopCb: "yellow",
      flopFoldCb: "green",
    },
    ranges: {
      vpip: [45, 70],
      pfr: [2, 8],
      agg: [0.5, 1.3],
      threeBet: [0, 2.2],
      foldThreeBet: [22, 44],
      flopCb: [52, 66],
      flopFoldCb: [18, 36],
    },
    fullring: {
      vpip: [45, 65],
      pfr: [2, 8],
      threeBet: [0, 2.2],
      foldThreeBet: [22, 44],
    },
  },
  {
    id: "maniac",
    label: "Maniac",
    anchor: { fullring: "93 / 78", "6max": "93 / 78" },
    tell: "Solid red, broken only by the two fold stats. Bets constantly, folds never. Call down light.",
    pattern: {
      vpip: "red",
      pfr: "red",
      agg: "red",
      threeBet: "red",
      foldThreeBet: "green",
      flopCb: "red",
      flopFoldCb: "green",
    },
    ranges: {
      vpip: [78, 95],
      pfr: [55, 80],
      agg: [4.5, 8.0],
      threeBet: [16.0, 28.0],
      foldThreeBet: [15, 35],
      flopCb: [82, 95],
      flopFoldCb: [12, 28],
    },
    fullring: {
      vpip: [78, 95],
      pfr: [55, 80],
      threeBet: [14.0, 25.0],
      foldThreeBet: [15, 35],
    },
  },
];

export function playerType(id: PlayerTypeId): PlayerType {
  const found = PLAYER_TYPES.find((type) => type.id === id);
  if (!found) throw new Error(`Unknown player type: ${id}`);
  return found;
}

/** The sampling range for one stat, with the full-ring override applied. */
export function rangeFor(
  type: PlayerType,
  stat: StatId,
  format: TableFormat,
): [number, number] | undefined {
  if (format === "fullring" && type.fullring[stat]) return type.fullring[stat];
  return type.ranges[stat];
}
