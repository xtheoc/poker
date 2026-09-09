import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionActions } from "@/components/session-actions";
import { heroDecisions } from "@/lib/hand-history/decisions";
import { parseHand } from "@/lib/hand-history/parse";
import { heroResult } from "@/lib/hand-history/result";
import type { Action, ParsedHand } from "@/lib/hand-history/types";
import { loadRawHand, loadViolations } from "@/lib/hands-store";
import { violationsInHand } from "@/lib/leaks";
import { BEGINNER_6MAX } from "@/lib/poker/charts/beginner-6max";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Hand" };

/**
 * Replaying a hand you got wrong.
 *
 * This is the thing a chart on a screen cannot do. Drilling teaches the range;
 * seeing the actual hand — your stack, the actual raiser, the money that
 * actually went in — is what attaches the range to a memory of playing it. The
 * mistake is marked in place in the action list rather than summarised
 * underneath, because the point is to see the moment, not to read about it.
 *
 * The hand is re-parsed from the stored text on every visit rather than read
 * out of the parsed columns. That is deliberate: it means a parser fix improves
 * hands imported months ago, and it keeps one code path between importing and
 * replaying.
 */
export default async function HandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();

  const [raw, allViolations] = await Promise.all([
    loadRawHand(session.supabase, session.userId, id),
    loadViolations(session.supabase, session.userId),
  ]);
  if (!raw) notFound();

  // The chain of hands you got wrong, newest first, one entry per hand — a hand
  // with two violations is still one stop on the tour. Reviewing mistakes is a
  // pass through a list, and until now every step of it went back to a session
  // page to find the next one, which is enough friction to stop after two.
  const trail = [...new Set(allViolations.map((v) => v.handId))];
  const position = trail.indexOf(id);

  const parsed = parseHand(raw);
  if (!parsed.ok) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <BackLink />
        <p className="mt-6 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Stored, but not currently readable: {parsed.error.reason}.
        </p>
      </main>
    );
  }

  const hand = parsed.hand;
  const decisions = heroDecisions(hand, {
    treeId: BEGINNER_6MAX.treeId,
    chartStackBb: BEGINNER_6MAX.stackBb,
  });
  const violations = violationsInHand(hand, decisions, BEGINNER_6MAX);
  const mistake = violations[0];
  const result = heroResult(hand);
  const heroName = hand.hero?.player;

  // The hero's first preflop action: the moment the chart has an opinion about,
  // and the one worth marking in the transcript.
  const markedAction = heroName
    ? hand.streets
        .find((s) => s.street === "preflop")
        ?.actions.find(
          (a) =>
            a.player === heroName &&
            ["fold", "check", "call", "bet", "raise"].includes(a.type),
        )
    : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="flex items-baseline justify-between gap-3">
        <BackLink />
        <MistakeNav trail={trail} position={position} />
      </div>

      <header className="mt-2 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {hand.hero ? (
            <span className="font-mono">{hand.hero.cards.join(" ")}</span>
          ) : (
            "Hand"
          )}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {hand.playedAt.toLocaleString()} · {hand.tableName} ·{" "}
          {hand.currency ?? ""}
          {hand.smallBlind}/{hand.bigBlind}
          {result && (
            <>
              {" · "}
              <span
                className={cn(
                  "font-medium",
                  result.netBb > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : result.netBb < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "",
                )}
              >
                {result.netBb > 0 ? "+" : ""}
                {result.netBb.toFixed(1)}bb
              </span>
            </>
          )}
        </p>
      </header>

      {mistake && (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
          <p className="text-sm font-medium text-rose-900 dark:text-rose-200">
            {mistake.spot} · you {mistake.chosen}ed, the chart{" "}
            {mistake.expected}s
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/drill/charts"
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-900 dark:border-rose-800 dark:text-rose-200"
            >
              See the range
            </Link>
            <Link
              // The same id the leak engine builds, so this lands on a drill of
              // exactly this spot rather than the full rotation.
              href={`/drill?leak=${encodeURIComponent(
                `${mistake.nodeId}#${mistake.kind}`,
              )}`}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              Drill this spot
            </Link>
          </div>
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">The table</h2>
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {hand.seats.map((seat) => (
            <li key={seat.seat} className="flex items-baseline gap-3 py-1.5">
              <span className="w-10 text-xs text-zinc-400">
                {seat.position ?? `#${seat.seat}`}
              </span>
              <span
                className={cn(
                  seat.player === heroName && "font-semibold",
                  seat.sittingOut && "text-zinc-400",
                )}
              >
                {seat.player}
                {seat.player === heroName && " (you)"}
              </span>
              <span className="ml-auto text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {(seat.stack / hand.bigBlind).toFixed(0)}bb
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">The action</h2>
        <div className="space-y-4">
          {hand.streets.map((street) => (
            <div key={street.street}>
              <p className="mb-1 text-xs font-medium tracking-wide text-zinc-400 uppercase">
                {street.street}
                {street.cards.length > 0 && (
                  <span className="ml-2 font-mono tracking-normal text-zinc-600 normal-case dark:text-zinc-300">
                    {street.cards.join(" ")}
                  </span>
                )}
              </p>
              <ul className="space-y-0.5">
                {street.actions.map((action, i) => (
                  <li
                    key={`${street.street}-${i}`}
                    className={cn(
                      "flex items-baseline gap-2 rounded px-2 py-1 text-sm",
                      action === markedAction &&
                        (mistake
                          ? "bg-rose-100 dark:bg-rose-950/50"
                          : "bg-emerald-100 dark:bg-emerald-950/50"),
                      action.player === heroName && "font-medium",
                    )}
                  >
                    <span
                      className={cn(
                        action.player !== heroName &&
                          "text-zinc-500 dark:text-zinc-400",
                      )}
                    >
                      {action.player}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {describe(action, hand)}
                    </span>
                    {action === markedAction && mistake && (
                      <span className="ml-auto text-xs font-semibold text-rose-700 dark:text-rose-300">
                        chart says {mistake.expected}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {!mistake && decisions.some((d) => d.node) && (
        <p className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          Matched the chart.
        </p>
      )}

      <details className="mt-8">
        <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          Original text
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 p-3 font-mono text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {raw.trim()}
        </pre>
      </details>

      {/* One hand at a time, for the case a whole session does not cover: a
          single hand from a table that was not yours, or a misparse that grades
          as a mistake and drags a leak along behind it. */}
      <div className="mt-6">
        <SessionActions handIds={[id]} label="this hand" onDeleted="/hands" />
      </div>
    </main>
  );
}

/**
 * Step through the hands you got wrong.
 *
 * Newer is "previous" and older is "next", matching the direction the list
 * itself runs — the trail is newest-first, so walking forward walks backwards
 * in time, and labelling the arrows by time instead would put them in the
 * opposite order to the sessions you clicked in from.
 *
 * Renders nothing for a hand that is not in the trail: arriving at a clean hand
 * from a search should not offer to navigate a tour it is not part of.
 */
function MistakeNav({
  trail,
  position,
}: {
  trail: readonly string[];
  position: number;
}) {
  if (position < 0 || trail.length < 2) return null;

  const newer = position > 0 ? trail[position - 1] : undefined;
  const older = position < trail.length - 1 ? trail[position + 1] : undefined;

  const arrow =
    "rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

  return (
    <nav className="flex items-center gap-1">
      {newer ? (
        <Link href={`/hands/hand/${newer}`} className={arrow} title="Newer">
          ←
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-30")}>←</span>
      )}
      <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
        {position + 1} / {trail.length}
      </span>
      {older ? (
        <Link href={`/hands/hand/${older}`} className={arrow} title="Older">
          →
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-30")}>→</span>
      )}
    </nav>
  );
}

function BackLink() {
  return (
    <Link
      href="/hands"
      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
    >
      ← All sessions
    </Link>
  );
}

/** One action in words, with money in big blinds. */
function describe(action: Action, hand: ParsedHand): string {
  const bb = (amount: number) => `${(amount / hand.bigBlind).toFixed(1)}bb`;

  switch (action.type) {
    case "post-sb":
      return "posts the small blind";
    case "post-bb":
      return "posts the big blind";
    case "post-bb-and-sb":
      return "posts both blinds";
    case "post-ante":
      return "posts an ante";
    case "fold":
      return "folds";
    case "check":
      return "checks";
    case "call":
      return action.amount !== undefined ? `calls ${bb(action.amount)}` : "calls";
    case "bet":
      return action.amount !== undefined ? `bets ${bb(action.amount)}` : "bets";
    case "raise":
      // The stored amount is the street total, which is also the number that
      // matters when reading a hand back.
      return action.amount !== undefined
        ? `raises to ${bb(action.amount)}`
        : "raises";
    case "show":
      return `shows ${action.cards?.join(" ") ?? ""}`.trim();
    case "muck":
      return "mucks";
    case "collect":
      return action.amount !== undefined
        ? `collects ${bb(action.amount)}`
        : "collects the pot";
    case "uncalled-return":
      return action.amount !== undefined
        ? `gets ${bb(action.amount)} back`
        : "gets the uncalled bet back";
    case "timeout":
      return "times out";
    case "disconnect":
      return "disconnects";
    case "sit-out":
      return "sits out";
  }
}
