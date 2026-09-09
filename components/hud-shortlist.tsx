import { type StatId, TIERS, bandLabels } from "@/lib/hud/stats";

/**
 * The smallest HUD that still runs this playbook.
 *
 * Every stat on a badge costs attention, and attention is the scarce thing when
 * several tables are asking you to act. So the question is not "which stats are
 * interesting" but "which decisions on this sheet go dark without them" — and
 * answered that way the list is short.
 *
 * **The bands come from `lib/hud/stats.ts`**, the same table that colours the
 * Players drill. Typed out here they would be a third copy of numbers that have
 * already changed once, and prose is the copy nobody remembers to update.
 */

interface Keeper {
  id: StatId | "hands";
  label: string;
  /** What breaks without it. */
  decides: string;
  /** What each end of the scale tells you to do. */
  green?: string;
  red?: string;
}

const KEEP: readonly Keeper[] = [
  {
    id: "hands",
    label: "Hands",
    decides:
      "Whether to trust anything else on the badge. Under 20 hands, ignore the colours entirely.",
  },
  {
    id: "vpip",
    label: "VPIP",
    decides:
      "With PFR, the player type — which two thirds of this sheet depends on.",
    green: "Tight. Nit or TAG.",
    red: "Loose. Fish or maniac, and your income.",
  },
  {
    id: "pfr",
    label: "PFR",
    decides:
      "The other half of the type read. It separates a nit from a TAG, and a fish from a maniac.",
    green: "Passive. He calls rather than raises.",
    red: "Genuinely aggressive.",
  },
  {
    id: "flopFoldCb",
    label: "Fold to cbet",
    decides: "How to bet at him on the flop, and whether he can be bluffed.",
    green:
      "Sticky — he will not fold. Bet 75% with a good hand, never bluff him, and give his call little credit.",
    red: "He folds too much. Cbet him relentlessly, and 3-bet him light in position.",
  },
  {
    id: "agg",
    label: "AF",
    decides:
      "Every river call you make. Without it you are guessing on the biggest bets of the hand.",
    green: "He cannot bluff. Fold your bluff-catchers.",
    red: "Call wide, sometimes with middle pair.",
  },
];

/** What each stat needs before it means anything. */
function minHands(id: StatId | "hands"): number {
  if (id === "hands") return 0;
  return TIERS.find((tier) => tier.stats.includes(id))?.minHands ?? 0;
}

const DROP: ReadonlyArray<[string, string]> = [
  [
    "3-bet · Fold to 3-bet",
    "They only feed the light 3-bet, and fold-to-cbet already tells you that. Two stats for one rule you rarely use.",
  ],
  ["Cbet", "Nothing on this sheet turns on it."],
  [
    "Turn and river stats",
    "They need 500 to 1,000 hands. You will never have that on the recreational players you most want to read.",
  ],
  [
    "Donk bet",
    "Leave it in the popup. You check it once a session, not mid-hand.",
  ],
];

export function HudShortlist() {
  return (
    <section id="hud" className="mb-10 scroll-mt-20">
      <h2 className="border-b border-zinc-900 pb-1.5 text-base font-semibold dark:border-zinc-100">
        Your HUD
      </h2>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Five stats. Every extra one costs attention you need for the decision.
      </p>

      <ul className="mt-4 space-y-3">
        {KEEP.map((stat) => {
          const bands = stat.id === "hands" ? null : bandLabels(stat.id, "6max");
          const needs = minHands(stat.id);

          return (
            <li
              key={stat.label}
              className="border-l-[3px] border-l-zinc-300 bg-zinc-50 py-2 pr-2 pl-3 dark:border-l-zinc-600 dark:bg-zinc-900/40"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold">{stat.label}</span>
                {needs > 0 && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {needs}+ hands
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {stat.decides}
              </p>

              {bands && (
                <dl className="mt-1.5 space-y-0.5">
                  <Band
                    tone="text-emerald-700 dark:text-emerald-400"
                    range={bands.green}
                    say={stat.green}
                  />
                  <Band
                    tone="text-amber-700 dark:text-amber-400"
                    range={bands.yellow}
                  />
                  <Band
                    tone="text-rose-700 dark:text-rose-400"
                    range={bands.red}
                    say={stat.red}
                  />
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
        Take these off
      </h3>
      <ul className="space-y-px">
        {DROP.map(([label, why]) => (
          <li
            key={label}
            className="grid gap-x-3 border-l-[3px] border-l-rose-500 bg-zinc-50 py-1.5 pr-2 pl-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] dark:bg-zinc-900/40"
          >
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {label}
            </span>
            <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
              {why}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One colour band, with what it tells you to do where that is worth saying. */
function Band({
  tone,
  range,
  say,
}: {
  tone: string;
  range: string;
  say?: string;
}) {
  return (
    <div className="flex gap-2 text-xs">
      <dt className={`w-14 shrink-0 font-mono tabular-nums ${tone}`}>{range}</dt>
      {say && <dd className="text-zinc-600 dark:text-zinc-400">{say}</dd>}
    </div>
  );
}
