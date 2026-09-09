import Link from "next/link";
import { MigrationNotice } from "@/components/migration-notice";
import { PlayerDrill } from "@/components/player-drill";
import { QuickfireDrill } from "@/components/quickfire-drill";
import { RangeDrill } from "@/components/range-drill";
import { dealHud } from "@/lib/hud/deal";
import { MissingTableError, loadViolations } from "@/lib/hands-store";
import { type Violation, findLeaks } from "@/lib/leaks";
import { BEGINNER_6MAX } from "@/lib/poker/charts/beginner-6max";
import { cycleLeakSpots, leakTargets } from "@/lib/poker/leak-drill";
import { dealSession } from "@/lib/poker/quickfire";
import { optionalUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Preflop drill" };

/**
 * The preflop drill. One page, two modes.
 *
 * **Your hands** cycles the spots you have actually misplayed, most recent
 * first, and does not end. **Random** deals from the whole tree in runs of
 * twenty. Your hands is the default whenever there are any — practising what
 * your own hands say is costing money beats practising the tree evenly.
 *
 * There is deliberately almost no text on this screen. Everything here is
 * subordinate to speed, and prose is something you would have to stop and read.
 */

/** How many spots to send down with the first render. */
const FIRST_BATCH = 20;

type Mode = "mine" | "random" | "players" | "ranges";

export default async function DrillPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; leak?: string }>;
}) {
  const { mode: requested, leak: leakId } = await searchParams;
  const session = await optionalUser();

  let violations: Violation[] = [];
  let needsMigration = false;
  if (session) {
    try {
      violations = await loadViolations(session.supabase, session.userId);
    } catch (error) {
      if (error instanceof MissingTableError) needsMigration = true;
      else throw error;
    }
  }

  const leaks = findLeaks(violations);
  // Arriving from a named leak drills only that one. Worth having because the
  // rotation is fair by design — it gives every leak equal time — and sometimes
  // you want the opposite: twenty spots on the one thing you keep getting wrong.
  //
  // An unknown id falls back to the full cycle rather than an empty drill. A
  // leak can genuinely disappear between the page that linked here and this one:
  // deleting the session that proved it is enough.
  const focused = leakId ? leaks.find((l) => l.id === leakId) : undefined;
  const targets = leakTargets(focused ? [focused] : leaks);
  const canDrillMine = targets.length > 0;

  const mode: Mode =
    requested === "players"
      ? "players"
      : requested === "ranges"
        ? "ranges"
        : requested === "random" || !canDrillMine
          ? "random"
          : "mine";

  // Neither reading players nor drawing ranges needs a dealt spot, and neither
  // needs any history — they are the two things here you can practise before
  // you have ever imported a hand.
  const spots =
    mode === "players" || mode === "ranges"
      ? []
      : mode === "mine"
        ? cycleLeakSpots(BEGINNER_6MAX, targets, FIRST_BATCH)
        : dealSession(BEGINNER_6MAX, FIRST_BATCH);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <Modes active={mode} canDrillMine={canDrillMine} />

      {needsMigration && (
        <div className="mt-4">
          <MigrationNotice
            file="supabase/migrations/0003_hands.sql"
            what="The tables that store your hands do not exist yet."
          />
        </div>
      )}

      {focused && mode === "mine" && (
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <span className="text-sm">{focused.label}</span>
          <Link
            href="/drill"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            All leaks →
          </Link>
        </div>
      )}

      <div className="mt-8">
        {mode === "ranges" ? (
          <RangeDrill chartSet={BEGINNER_6MAX} />
        ) : mode === "players" ? (
          <PlayerDrill initial={dealHud()} />
        ) : (
          <QuickfireDrill
            // Keyed by mode and leak so switching either deals a genuinely
            // fresh drill rather than continuing the old one with new spots
            // spliced in.
            key={`${mode}:${focused?.id ?? ""}`}
            chartSet={BEGINNER_6MAX}
            initialSpots={spots}
            signedIn={session !== null}
            targets={mode === "mine" ? targets : undefined}
          />
        )}
      </div>
    </main>
  );
}

function Modes({ active, canDrillMine }: { active: Mode; canDrillMine: boolean }) {
  const tabs: Array<{ mode: Mode; href: string; label: string }> = [
    { mode: "mine", href: "/drill", label: "Your hands" },
    { mode: "random", href: "/drill?mode=random", label: "Random" },
    { mode: "players", href: "/drill?mode=players", label: "Players" },
    { mode: "ranges", href: "/drill?mode=ranges", label: "Ranges" },
  ];

  return (
    <div className="mx-auto flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-800">
      {tabs.map((tab) => {
        const disabled = tab.mode === "mine" && !canDrillMine;
        const className = cn(
          "rounded-lg px-4 py-1.5 text-sm transition",
          active === tab.mode
            ? "bg-zinc-900 font-medium text-white dark:bg-white dark:text-zinc-900"
            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
          disabled && "cursor-not-allowed opacity-40",
        );

        return disabled ? (
          <span
            key={tab.mode}
            className={className}
            title="Import a session first"
          >
            {tab.label}
          </span>
        ) : (
          <Link key={tab.mode} href={tab.href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
