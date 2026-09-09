import { PLAYSTYLE, type PlayAct } from "@/lib/playstyle";
import { cn } from "@/lib/utils";

/**
 * The playstyle, laid out to be checked rather than read.
 *
 * Two columns per line — the condition, then what to do — because that is the
 * shape of the question you actually have: *this* is happening, so what now.
 * Prose would bury the condition inside a sentence and make you find it.
 *
 * Colour carries the action, so a section reads before it is read: mostly green
 * means this is a betting spot, mostly red means the discipline is in the
 * folding. The words say the same thing, so the colour is never load-bearing on
 * its own.
 */

/** Left border and text colour per action. */
const TONE: Record<PlayAct, { bar: string; text: string }> = {
  bet: {
    bar: "border-l-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  check: {
    bar: "border-l-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  fold: { bar: "border-l-rose-500", text: "text-rose-700 dark:text-rose-400" },
  read: {
    bar: "border-l-zinc-300 dark:border-l-zinc-600",
    text: "text-zinc-700 dark:text-zinc-300",
  },
};

const LEGEND: ReadonlyArray<[PlayAct, string]> = [
  ["bet", "Bet / raise"],
  ["check", "Check / call"],
  ["fold", "Fold / never"],
  ["read", "Read"],
];

export function PlaystyleCard() {
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {LEGEND.map(([act, label]) => (
          <span
            key={act}
            className="flex items-center gap-1.5 text-[10px] tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
          >
            <span
              className={cn("h-3 w-1 rounded-[1px]", BAR_FILL[act])}
              aria-hidden
            />
            {label}
          </span>
        ))}
      </div>

      {PLAYSTYLE.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-20">
          <h2 className="border-b border-zinc-900 pb-1.5 text-base font-semibold dark:border-zinc-100">
            {section.title}
          </h2>

          {section.groups.map((group, g) => (
            <div key={group.heading ?? `g${g}`} className="mt-4">
              {group.heading && (
                <h3 className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
                  {group.heading}
                </h3>
              )}

              <ul className="space-y-px">
                {group.lines.map((line) => (
                  <li
                    key={line.then}
                    className={cn(
                      "grid gap-x-3 border-l-[3px] bg-zinc-50 py-1.5 pr-2 pl-3 dark:bg-zinc-900/40",
                      // A line with no condition is always true, so it takes
                      // the full width rather than leaving an empty column.
                      line.when &&
                        "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]",
                      TONE[line.act].bar,
                    )}
                  >
                    {line.when && (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {line.when}
                      </span>
                    )}
                    <span
                      className={cn("text-xs font-medium", TONE[line.act].text)}
                    >
                      {line.then}
                    </span>
                  </li>
                ))}
              </ul>

              {group.note && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {group.note}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Solid swatches for the legend, where there is no row to draw a border on. */
const BAR_FILL: Record<PlayAct, string> = {
  bet: "bg-emerald-500",
  check: "bg-amber-500",
  fold: "bg-rose-500",
  read: "bg-zinc-300 dark:bg-zinc-600",
};
