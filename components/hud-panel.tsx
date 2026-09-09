import type { HudRead } from "@/lib/hud/deal";
import {
  HUD_ROWS,
  type HudColour,
  STATS,
  type StatId,
  colourOf,
} from "@/lib/hud/stats";
import { cn } from "@/lib/utils";

/**
 * The HUD, as it sits over a seat.
 *
 * Deliberately close to HM3's own look — dark block, slash-separated, colour on
 * the numerals rather than behind them. The point of the drill is to make the
 * real thing readable at a glance, and practising against a prettier version
 * would be practising against something you never see.
 *
 * Stats the sample does not support are drawn as dashes rather than hidden. A
 * HUD with gaps in it is the normal case at a table, and the shape of the gaps
 * is itself information: two numbers and a wall of dashes means you are reading
 * a stranger off VPIP and PFR alone, and the drill wants that to feel exactly
 * as thin as it is.
 */

const COLOURS: Record<HudColour, string> = {
  green: "text-emerald-400",
  yellow: "text-amber-300",
  red: "text-rose-400",
};

export function HudPanel({
  read,
  showLabels = false,
  blind = [],
}: {
  read: HudRead;
  /** Name each stat under the block. Off during the drill; on in review. */
  showLabels?: boolean;
  /**
   * Stats to print without their colour.
   *
   * The number is still shown and still true — what goes is the shortcut. A
   * grey 26 has to be measured against a band you remember rather than read off
   * a hue, which is the difference between knowing the ranges and knowing which
   * colours go together.
   */
  blind?: readonly StatId[];
}) {
  return (
    <div className="inline-block rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm">
      <p className="mb-1 border-b border-zinc-800 pb-1 text-[10px] tracking-wide text-zinc-500 uppercase">
        Player
      </p>

      {HUD_ROWS.map((row, i) => (
        <div key={row.join()} className="flex items-baseline gap-1 leading-6">
          {row.map((id, j) => (
            <span key={id} className="flex items-baseline gap-1">
              {j > 0 && <span className="text-zinc-600">/</span>}
              <Value read={read} id={id} blind={blind.includes(id)} />
            </span>
          ))}

          {/* Hands closes the last row, uncoloured. It is a sample size, not a
              tendency, and colouring it would imply it had a direction. */}
          {i === HUD_ROWS.length - 1 && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="tabular-nums text-zinc-300">{read.hands}</span>
            </>
          )}
        </div>
      ))}

      {showLabels && (
        <div className="mt-2 border-t border-zinc-800 pt-2 text-[10px] leading-4 text-zinc-500">
          {HUD_ROWS.map((row, i) => (
            <p key={row.join()}>
              {row.map((id) => STATS[id].label).join(" / ")}
              {i === HUD_ROWS.length - 1 && " / Hands"}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Value({
  read,
  id,
  blind,
}: {
  read: HudRead;
  id: StatId;
  blind: boolean;
}) {
  const value = read.values[id];
  if (value === undefined) {
    return <span className="tabular-nums text-zinc-600">–</span>;
  }

  const stat = STATS[id];
  return (
    <span
      title={stat.label}
      className={cn(
        "tabular-nums",
        // Grey, but not dim: a blinded stat is the one you most need to read.
        blind ? "text-zinc-200" : COLOURS[colourOf(id, value, read.format)],
      )}
    >
      {value.toFixed(stat.decimals)}
    </span>
  );
}
