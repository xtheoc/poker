import Link from "next/link";
import { notFound } from "next/navigation";
import { StrategyNav } from "@/components/strategy-nav";
import { getLearningStrategy } from "@/lib/strategies";
import {
  loadStrategySessionHands,
  type StrategySessionHand,
} from "@/lib/strategies/hand-review";
import { requireUser } from "@/lib/session";
import { groupSessions, sessionContaining, statsFor } from "@/lib/sessions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Session" };

/**
 * A session is the immediate post-play check: every hand, one verdict per row.
 *
 * No leak ranking is repeated here. The question just after playing is whether
 * the import arrived and which exact decisions need another look.
 */
export default async function StrategySessionPage({
  params,
}: {
  params: Promise<{ strategyId: string; sessionId: string }>;
}) {
  const { strategyId, sessionId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) notFound();

  const session = await requireUser();
  const hands = await loadStrategySessionHands(
    session.supabase,
    session.userId,
    strategy.id,
  );
  const play = sessionContaining(groupSessions(hands), sessionId);
  if (!play) notFound();
  const reviewedHands = play.hands as StrategySessionHand[];

  const stats = statsFor(play.hands);
  const title = play.startedAt.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = play.startedAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <header className="mt-8 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <Link
          href={`/strategies/${strategy.id}/hands`}
          className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          ← Sessions
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {time} · {stats.hands} {stats.hands === 1 ? "hand" : "hands"}
          {stats.minutes > 0 && ` · ${stats.minutes} min`}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm tabular-nums">
          <span className={stats.netBb >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            {stats.netBb >= 0 ? "+" : ""}{stats.netBb.toFixed(1)}bb
          </span>
          {stats.charted > 0 && <span>{stats.accuracy.toFixed(0)}% right</span>}
          {stats.mistakes > 0 && <span className="text-rose-600 dark:text-rose-400">{stats.mistakes} to review</span>}
        </div>
      </header>

      <section className="mt-6">
        <div className="grid grid-cols-[4.5rem_1fr_3rem_4.5rem] gap-x-3 border-b border-zinc-200 px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
          <span>Time</span>
          <span>Hand</span>
          <span>Seat</span>
          <span className="text-right">Result</span>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {reviewedHands.map((hand) => {
            const status = hand.mistakes > 0
              ? "needs review"
              : hand.chartedDecisions > 0
                ? "correct"
                : "not covered";
            const cards = hand.cards.length > 0 ? hand.cards.join(" ") : hand.handClass ?? "—";

            return (
              <li
                key={hand.psHandId}
                className="grid grid-cols-[4.5rem_1fr_3rem_4.5rem] items-center gap-x-3 px-2 py-3 text-sm"
              >
                <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                  {hand.playedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>
                  <span className="font-mono font-medium">{cards}</span>
                  <span
                    className={cn(
                      "ml-2 text-xs",
                      status === "needs review" && "text-rose-600 dark:text-rose-400",
                      status === "correct" && "text-emerald-600 dark:text-emerald-400",
                      status === "not covered" && "text-zinc-400 dark:text-zinc-500",
                    )}
                  >
                    {status}
                  </span>
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{hand.position ?? "—"}</span>
                <span className={cn(
                  "text-right text-xs tabular-nums",
                  hand.netBb > 0 && "text-emerald-600 dark:text-emerald-400",
                  hand.netBb < 0 && "text-rose-600 dark:text-rose-400",
                  hand.netBb === 0 && "text-zinc-400 dark:text-zinc-500",
                )}>
                  {hand.netBb > 0 ? "+" : ""}{hand.netBb.toFixed(1)}bb
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
