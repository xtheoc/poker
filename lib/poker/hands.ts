/**
 * The 169 starting-hand classes, and the range notation used to describe sets
 * of them.
 *
 * Everything in this platform ultimately grounds out here: a chart maps hand
 * classes to strategies, a drill samples hand classes, and a parsed hand
 * history is classified by the hand class the hero held. Getting this wrong
 * corrupts every verdict downstream, which is why it is the most heavily
 * tested module in the codebase.
 *
 * We write our own notation parser rather than take a dependency. Every
 * JavaScript option is either dormant or expands only to hand classes with no
 * weight support, and the grammar is small enough that owning it costs less
 * than working around someone else's gaps.
 */

/** Ranks, low to high. Index in this array is the rank's strength ordinal. */
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;

export type Rank = (typeof RANKS)[number];

/** Rank → ordinal, where A is 12 and 2 is 0. */
const RANK_INDEX: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i]),
);

export type HandShape = "pair" | "suited" | "offsuit";

/**
 * A hand class in the canonical notation: "AA", "AKs", "AKo".
 *
 * Always written high card first, so "KAs" is not a valid hand class even
 * though a human might type it. `parseHand` normalises; the rest of the
 * codebase may assume canonical form.
 */
export type Hand = string;

/** How many of the 1,326 possible two-card combinations each shape covers. */
export const COMBOS_BY_SHAPE: Record<HandShape, number> = {
  pair: 6,
  suited: 4,
  offsuit: 12,
};

export interface ParsedHand {
  hand: Hand;
  high: Rank;
  low: Rank;
  shape: HandShape;
  /** Number of card combinations this class represents. */
  combos: number;
}

/**
 * Parse a hand class, normalising card order. Returns null rather than
 * throwing, because this runs against hand-history text and user input where
 * a malformed token is a data problem to be surfaced, not a crash.
 */
export function parseHand(input: string): ParsedHand | null {
  const text = input.trim();
  if (text.length < 2 || text.length > 3) return null;

  const a = text[0].toUpperCase();
  const b = text[1].toUpperCase();
  if (!(a in RANK_INDEX) || !(b in RANK_INDEX)) return null;

  const suffix = text.length === 3 ? text[2].toLowerCase() : "";

  // Order the two ranks so the stronger one is always written first.
  const [high, low] =
    RANK_INDEX[a] >= RANK_INDEX[b] ? [a as Rank, b as Rank] : [b as Rank, a as Rank];

  if (high === low) {
    // A pair cannot be suited — "AAs" is nonsense, not a synonym for AA.
    if (suffix !== "") return null;
    return { hand: `${high}${low}`, high, low, shape: "pair", combos: 6 };
  }

  if (suffix !== "s" && suffix !== "o") return null;
  const shape: HandShape = suffix === "s" ? "suited" : "offsuit";
  return {
    hand: `${high}${low}${suffix}`,
    high,
    low,
    shape,
    combos: COMBOS_BY_SHAPE[shape],
  };
}

/**
 * The hand class for two actual cards: ["Ac", "4h"] becomes "A4o".
 *
 * This is the join between a hand history, which deals in real cards, and a
 * chart, which deals in the 169 classes. Returns null on anything malformed
 * rather than guessing — a misread hand would be filed against the wrong chart
 * entry and counted as a mistake the player never made.
 */
export function handClassFromCards(cards: readonly string[]): Hand | null {
  if (cards.length !== 2) return null;

  const [first, second] = cards.map((c) => c.trim());
  if (first?.length !== 2 || second?.length !== 2) return null;

  const rankA = first[0].toUpperCase();
  const rankB = second[0].toUpperCase();
  if (!(rankA in RANK_INDEX) || !(rankB in RANK_INDEX)) return null;

  const suitA = first[1].toLowerCase();
  const suitB = second[1].toLowerCase();
  if (!"cdhs".includes(suitA) || !"cdhs".includes(suitB)) return null;

  // The same card twice is a corrupt line, not a pair.
  if (rankA === rankB && suitA === suitB) return null;

  if (rankA === rankB) return `${rankA}${rankB}`;
  return parseHand(`${rankA}${rankB}${suitA === suitB ? "s" : "o"}`)?.hand ?? null;
}

/** Every hand class, in a stable order: pairs high-to-low, then suited, then offsuit. */
export function allHands(): Hand[] {
  const pairs: Hand[] = [];
  const suited: Hand[] = [];
  const offsuit: Hand[] = [];

  for (let hi = RANKS.length - 1; hi >= 0; hi--) {
    pairs.push(`${RANKS[hi]}${RANKS[hi]}`);
    for (let lo = hi - 1; lo >= 0; lo--) {
      suited.push(`${RANKS[hi]}${RANKS[lo]}s`);
      offsuit.push(`${RANKS[hi]}${RANKS[lo]}o`);
    }
  }
  return [...pairs, ...suited, ...offsuit];
}

/** Combination count for a hand class, used to weight frequency-correct sampling. */
/**
 * The 169 classes in the conventional 13x13 layout.
 *
 * Pairs down the diagonal, suited above it, offsuit below, ranks descending
 * from the top left. Every poker tool draws it this way, and that consistency
 * is worth more than any improvement anyone could invent — someone who has seen
 * a range chart elsewhere can read one here without being taught.
 *
 * Shared so two grids on the same screen cannot disagree about which cell is
 * which. A layout defined twice is one that eventually differs, and the failure
 * would be silent: you would select K9s and be marked on K9o.
 */
export function handGrid(): Hand[][] {
  const descending = [...RANKS].reverse();

  return descending.map((_, row) =>
    descending.map((__, col) => {
      if (row === col) return `${descending[row]}${descending[col]}`;
      // Above the diagonal is suited, and the row holds the higher card there.
      if (row < col) return `${descending[row]}${descending[col]}s`;
      return `${descending[col]}${descending[row]}o`;
    }),
  );
}

export function combosOf(hand: Hand): number {
  return parseHand(hand)?.combos ?? 0;
}

/**
 * A range: hand class → weight in [0,1].
 *
 * A weight is a *frequency* — how often this hand appears in the range — and is
 * deliberately not a strategy. A strategy needs a probability vector over the
 * action set, which this cannot express; that lives in the chart layer. Ranges
 * exist for interop and for describing "which hands reach this node".
 */
export type Range = Map<Hand, number>;

/**
 * Parse range notation into hand classes with weights.
 *
 * Supported grammar, matching the PioSOLVER convention that every other tool
 * has settled on:
 *
 * - singletons          `AA`, `AKs`, `AKo`
 * - plus ranges         `TT+`, `AJs+`, `T9s+`
 * - dash ranges         `QQ-88`, `A9s-A6s`
 * - weights             `AA:0.5`
 * - comma or whitespace separated groups
 *
 * On the meaning of `+`, which tools genuinely disagree about: it raises the
 * *lower* card up to one below the higher card, so `AJs+` is AJs/AQs/AKs. For a
 * connector that rule would be a no-op — `T9s+` would mean only T9s — so for
 * connectors it instead preserves the gap and walks both cards up, giving
 * T9s/JTs/QJs/KQs/AKs. Anything ambiguous should be written as an explicit dash
 * range instead; we author our own charts, so this costs us nothing.
 *
 * Throws on malformed input. Unlike `parseHand`, this parses authored chart
 * data and test fixtures, where a typo must fail loudly rather than silently
 * produce a range that is subtly missing hands.
 */
export function parseRange(notation: string): Range {
  const range: Range = new Map();
  const tokens = notation
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  for (const token of tokens) {
    const [body, weightText] = splitWeight(token);
    const weight = parseWeight(weightText, token);

    for (const hand of expandToken(body, token)) {
      // A hand listed twice keeps the highest weight it was given. Overlapping
      // groups are common in hand-authored charts ("TT+, AQs+, AKs") and the
      // wider intent should win rather than the last line written.
      const existing = range.get(hand);
      if (existing === undefined || weight > existing) range.set(hand, weight);
    }
  }

  return range;
}

function splitWeight(token: string): [string, string | undefined] {
  const colon = token.indexOf(":");
  if (colon === -1) return [token, undefined];
  return [token.slice(0, colon), token.slice(colon + 1)];
}

function parseWeight(text: string | undefined, token: string): number {
  if (text === undefined) return 1;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid weight in range token "${token}": expected 0..1`);
  }
  return value;
}

function expandToken(body: string, token: string): Hand[] {
  if (body.includes("-")) return expandDash(body, token);
  if (body.endsWith("+")) return expandPlus(body.slice(0, -1), token);

  const parsed = parseHand(body);
  if (!parsed) throw new Error(`Invalid hand in range: "${token}"`);
  return [parsed.hand];
}

function expandDash(body: string, token: string): Hand[] {
  const [fromText, toText] = body.split("-");
  const from = parseHand(fromText ?? "");
  const to = parseHand(toText ?? "");
  if (!from || !to) throw new Error(`Invalid dash range: "${token}"`);
  if (from.shape !== to.shape) {
    throw new Error(`Dash range must not change hand shape: "${token}"`);
  }

  if (from.shape === "pair") {
    return pairsBetween(RANK_INDEX[from.high], RANK_INDEX[to.high]);
  }

  // Non-pair dash ranges hold the high card and walk the kicker, which is the
  // only reading that makes "A9s-A6s" mean what everyone writes it to mean.
  if (from.high !== to.high) {
    throw new Error(`Dash range must keep the same high card: "${token}"`);
  }
  const suffix = from.shape === "suited" ? "s" : "o";
  const hands: Hand[] = [];
  const [lo, hi] = sorted(RANK_INDEX[from.low], RANK_INDEX[to.low]);
  for (let k = lo; k <= hi; k++) {
    hands.push(`${from.high}${RANKS[k]}${suffix}`);
  }
  return hands;
}

function expandPlus(body: string, token: string): Hand[] {
  const parsed = parseHand(body);
  if (!parsed) throw new Error(`Invalid hand in plus range: "${token}"`);

  if (parsed.shape === "pair") {
    return pairsBetween(RANK_INDEX[parsed.high], RANK_INDEX.A);
  }

  const suffix = parsed.shape === "suited" ? "s" : "o";
  const highIndex = RANK_INDEX[parsed.high];
  const lowIndex = RANK_INDEX[parsed.low];
  const hands: Hand[] = [];

  if (lowIndex === highIndex - 1) {
    // Connector: walk both cards up together, preserving the gap.
    for (let h = highIndex; h <= RANK_INDEX.A; h++) {
      hands.push(`${RANKS[h]}${RANKS[h - 1]}${suffix}`);
    }
    return hands;
  }

  // Otherwise raise the kicker to one below the high card.
  for (let k = lowIndex; k < highIndex; k++) {
    hands.push(`${parsed.high}${RANKS[k]}${suffix}`);
  }
  return hands;
}

function pairsBetween(a: number, b: number): Hand[] {
  const [lo, hi] = sorted(a, b);
  const hands: Hand[] = [];
  for (let r = lo; r <= hi; r++) hands.push(`${RANKS[r]}${RANKS[r]}`);
  return hands;
}

function sorted(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

/**
 * Total combinations in a range, weights included.
 *
 * This is what makes "how much of my range is this?" answerable, and it is the
 * denominator for frequency-correct hand sampling in a drill.
 */
export function rangeCombos(range: Range): number {
  let total = 0;
  for (const [hand, weight] of range) total += combosOf(hand) * weight;
  return total;
}

/** Share of all 1,326 combinations a range covers, as a percentage. */
export function rangePercent(range: Range): number {
  return (rangeCombos(range) / 1326) * 100;
}

/** Render a range back to canonical notation, for display and interop. */
export function formatRange(range: Range): string {
  return allHands()
    .filter((h) => (range.get(h) ?? 0) > 0)
    .map((h) => {
      const w = range.get(h)!;
      return w === 1 ? h : `${h}:${w}`;
    })
    .join(",");
}
