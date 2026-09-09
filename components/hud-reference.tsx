import { GRADED_STATS, PLAYER_TYPES } from "@/lib/hud/players";
import {
  HUD_ROWS,
  type HudColour,
  STATS,
  type StatId,
  type TableFormat,
  bandLabels,
} from "@/lib/hud/stats";
import { cn } from "@/lib/utils";

/**
 * The answer key, on demand.
 *
 * Two tables, and the order is deliberate. **The patterns come first**, because
 * that is what you are actually learning: five shapes, seven columns, read left
 * to right. **The numbers come second**, because they are the fallback when a
 * colour is not obvious — memorising boundaries is not the skill, recognising
 * shapes is.
 *
 * Both render from the same data the drill grades against. A reference card
 * typed out separately would eventually disagree with the grader, and you would
 * believe the card.
 *
 * Unlike the preflop drill's chart, opening this costs nothing. That drill
 * prices its chart because those ranges are memorised and looking them up is
 * the habit being trained out of you. Here the table is new, small, and worth
 * consulting — a penalty would only discourage checking a fact you do not know
 * yet.
 */

const SWATCH: Record<HudColour, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

const TEXT: Record<HudColour, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-rose-600 dark:text-rose-400",
};

/** Short headers, so seven columns fit without wrapping. */
const SHORT: Partial<Record<StatId, string>> = {
  vpip: "VP",
  pfr: "PF",
  agg: "AF",
  threeBet: "3B",
  foldThreeBet: "F3",
  flopCb: "CB",
  flopFoldCb: "FC",
};

export function HudReference({ format }: { format: TableFormat }) {
  return (
    <div className="mt-4 w-full max-w-sm space-y-5 rounded-xl border border-zinc-200 p-4 text-left dark:border-zinc-800">
      <div>
        <h3 className="mb-2 text-xs font-semibold">The five shapes</h3>

        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 dark:text-zinc-500">
              <th className="pb-1 text-left font-normal">Type</th>
              {GRADED_STATS.map((id) => (
                <th
                  key={id}
                  title={STATS[id].label}
                  className="pb-1 text-center font-normal"
                >
                  {SHORT[id]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAYER_TYPES.map((type) => (
              <tr key={type.id}>
                <td className="py-1 pr-2 font-medium">{type.label}</td>
                {GRADED_STATS.map((id) => {
                  const colour = type.pattern[id];
                  return (
                    <td key={id} className="py-1 text-center">
                      {colour && (
                        <span
                          title={`${STATS[id].label}: ${colour}`}
                          className={cn(
                            "inline-block size-3 rounded-[3px]",
                            SWATCH[colour],
                          )}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="mt-3 space-y-1.5">
          {PLAYER_TYPES.map((type) => (
            <li key={type.id} className="text-xs leading-relaxed">
              <span className="font-medium">{type.label}</span>
              <span className="ml-1.5 text-zinc-400 dark:text-zinc-500">
                {type.anchor[format]}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {" "}
                — {type.tell}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold">
          Colour ranges
          <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">
            {format === "6max" ? "6-max" : "full ring"}
          </span>
        </h3>

        <table className="w-full text-xs tabular-nums">
          <tbody>
            {HUD_ROWS.flat().map((id) => {
              const bands = bandLabels(id, format);
              return (
                <tr key={id}>
                  <td className="py-0.5 pr-2 text-zinc-500 dark:text-zinc-400">
                    {STATS[id].label}
                  </td>
                  {(["green", "yellow", "red"] as HudColour[]).map((colour) => (
                    <td
                      key={colour}
                      className={cn("py-0.5 pr-2 text-right", TEXT[colour])}
                    >
                      {bands[colour]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          Green is a low number, red a high one — on every stat. Green does not
          mean a bad player: a maniac is red nearly everywhere and is the best
          seat at the table.
        </p>
      </div>
    </div>
  );
}
