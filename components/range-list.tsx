import { type ChartSet, bestAction, strategyFor } from "@/lib/poker/charts";
import { RFI_RANGES } from "@/lib/poker/charts/beginner-6max";
import { type Hand, allHands, combosOf, parseHand } from "@/lib/poker/hands";
import { cn } from "@/lib/utils";

/**
 * The opening ranges as written, seat by seat, with what each one adds.
 *
 * A 13x13 grid shows you a shape; it does not show you that the cutoff is the
 * hijack plus thirty-one specific hands. This does, because the positional
 * widening is the actual lesson — the book's own summary of its chart is that
 * the important thing to take from it "is the positional bias in starting hand
 * selection", not any individual holding.
 *
 * Two things are shown per seat, and they check each other. The **notation** is
 * the string the chart was authored from, printed verbatim rather than
 * reconstructed — a compressor with a bug would show a range you are not graded
 * against, which is the one failure a page built for verifying ranges must not
 * have. The **additions** are computed from the expanded strategies, so if the
 * notation ever stopped meaning what it appears to mean, the two halves of a
 * row would disagree in front of you.
 */
interface RangeRow {
  position: string;
  notation: string;
  limp?: string;
  caveat?: string;
  percent: number;
  added: Hand[];
  dropped: Hand[];
  comparedTo: string;
  first: boolean;
}

/**
 * Walk the seats in order, diffing each against the one before.
 *
 * A plain function rather than work done while rendering: this carries state
 * from one row to the next, and a component that mutates a local across a
 * `.map` is the shape React's compiler rightly refuses.
 */
function describeRanges(chartSet: ChartSet): RangeRow[] {
  const rows: RangeRow[] = [];
  let previous: Set<Hand> | null = null;
  let previousLabel = "";

  for (const { position, notation, limp, caveat } of RFI_RANGES) {
    const node = chartSet.nodes.find(
      (n) => n.key.position === position && !n.key.villain,
    );

    const played = new Set<Hand>();
    if (node) {
      for (const hand of allHands()) {
        if (bestAction(strategyFor(node, hand)) !== "fold") played.add(hand);
      }
    }

    rows.push({
      position,
      notation,
      limp,
      caveat,
      percent: percentOf(played),
      added: bySuitAndRank([...played].filter((hand) => !previous?.has(hand))),
      dropped: bySuitAndRank(
        previous ? [...previous].filter((hand) => !played.has(hand)) : [],
      ),
      comparedTo: previousLabel,
      first: previous === null,
    });

    previous = played;
    previousLabel = position;
  }

  return rows;
}

export function RangeList({ chartSet }: { chartSet: ChartSet }) {
  const rows = describeRanges(chartSet);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">The ranges, in words</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Each seat as it was written into the chart, then what it adds to the
          seat before it. The small blind is compared to the button, so its row
          reads as a large drop rather than a widening — it is the one seat that
          tightens.
        </p>
      </div>

      <ol className="space-y-4">
        {rows.map((row) => (
          <li key={row.position}>
            <div className="flex items-baseline gap-2">
              <span className="w-9 text-sm font-semibold">{row.position}</span>
              <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {row.percent.toFixed(1)}% of hands
              </span>
            </div>

            <p className="mt-1 font-mono text-xs leading-relaxed break-words text-zinc-700 dark:text-zinc-300">
              {row.notation}
            </p>

            {/* Limps are part of the range, not a footnote — a hand played for
                one blind is still a hand played. Marked separately because the
                two lines are different decisions with different costs. */}
            {row.limp && (
              <p className="mt-0.5 font-mono text-xs leading-relaxed break-words text-sky-600 dark:text-sky-400">
                limp {row.limp}
              </p>
            )}

            {/* Printed next to the number it qualifies, not in a footnote at
                the bottom of the page. A caveat you have to go looking for is
                one the chart has effectively decided not to make. */}
            {row.caveat && (
              <p className="mt-1 text-xs leading-relaxed text-amber-600 dark:text-amber-500/90">
                {row.caveat}
              </p>
            )}

            {!row.first && (
              <div className="mt-1.5 space-y-1 text-xs">
                {row.added.length > 0 && (
                  <Delta
                    sign="+"
                    hands={row.added}
                    className="text-emerald-600 dark:text-emerald-400"
                    note={`added to ${row.comparedTo}`}
                  />
                )}
                {row.dropped.length > 0 && (
                  <Delta
                    sign="−"
                    hands={row.dropped}
                    className="text-rose-600 dark:text-rose-400"
                    note={`gone from ${row.comparedTo}`}
                  />
                )}
                {row.added.length === 0 && row.dropped.length === 0 && (
                  <p className="text-zinc-400 dark:text-zinc-500">
                    identical to {row.comparedTo}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Delta({
  sign,
  hands,
  className,
  note,
}: {
  sign: string;
  hands: Hand[];
  className: string;
  note: string;
}) {
  return (
    <p className="leading-relaxed">
      <span className={cn("font-mono", className)}>
        {sign} {hands.join(", ")}
      </span>
      <span className="ml-2 text-zinc-400 dark:text-zinc-500">
        {hands.length} {hands.length === 1 ? "hand" : "hands"} {note}
      </span>
    </p>
  );
}

/** Share of all 1,326 combinations these hand classes cover. */
function percentOf(hands: Iterable<Hand>): number {
  let combos = 0;
  for (const hand of hands) combos += combosOf(hand);
  return (combos / 1326) * 100;
}

/**
 * Pairs first, then suited, then offsuit, each strongest first.
 *
 * The order a chart is read in. An unsorted diff of thirty hands is a wall; the
 * same thirty grouped by shape are three short thoughts.
 */
function bySuitAndRank(hands: Hand[]): Hand[] {
  const order = { pair: 0, suited: 1, offsuit: 2 };
  const index = new Map(allHands().map((hand, i) => [hand, i]));

  return [...hands].sort((a, b) => {
    const shapeA = order[parseHand(a)?.shape ?? "offsuit"];
    const shapeB = order[parseHand(b)?.shape ?? "offsuit"];
    if (shapeA !== shapeB) return shapeA - shapeB;
    return (index.get(a) ?? 0) - (index.get(b) ?? 0);
  });
}
