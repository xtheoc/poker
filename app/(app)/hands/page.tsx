import Link from "next/link";
import { AccuracyTrend } from "@/components/accuracy-trend";
import { HandImport } from "@/components/hand-import";
import { LeakList } from "@/components/leak-list";
import { MigrationNotice } from "@/components/migration-notice";
import { PositionResults } from "@/components/position-results";
import { SessionActions } from "@/components/session-actions";
import {
  MissingTableError,
  loadSessionHands,
  loadViolations,
} from "@/lib/hands-store";
import { type Violation, findLeaks } from "@/lib/leaks";
import { optionalUser } from "@/lib/session";
import {
  type PlaySession,
  type SessionHand,
  accuracyTrend,
  groupSessions,
  groupWeeks,
  resultsByPosition,
  statsFor,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Hands" };

/**
 * Leaks shown on this page.
 *
 * They are ranked by cost, so anything past the first few is by construction
 * the part least worth acting on. Three is a list you can hold in your head
 * while you play; fourteen is a wall you scroll past.
 */
const TOP_LEAKS = 3;

/**
 * What your hands say about your game.
 *
 * This page used to open with an upload control and a setup guide — organised
 * around getting data *in*, which takes five seconds and happens twice a week.
 * The two things it should have led with were missing entirely: whether you are
 * improving, and what is currently costing you. Leaks in particular had no home
 * at all — they were visible only from inside a single session, filtered to that
 * session, which is precisely the view that cannot show a habit.
 *
 * So it now reads in the order you would actually want to know things. Accuracy
 * and its trend first, because that is the honest number: every charted decision
 * was inside the range or outside it, so it needs no sample gate the way the
 * frequency stats do. Then standing leaks, which are cross-session by
 * definition. Then the log. The import goes last, collapsed.
 *
 * Nothing here reads live game state and nothing runs while you are playing:
 * this is a post-session tool, which is the only shape PokerStars permits.
 */
export default async function HandsPage() {
  const session = await optionalUser();

  // A missing table is the one database failure with a specific fix, and it
  // happens once to everybody who sets this up. Anything else still throws:
  // a real bug should stay loud rather than hiding behind a friendly message.
  let hands: SessionHand[] = [];
  let violations: Violation[] = [];
  let needsMigration = false;

  if (session) {
    try {
      [hands, violations] = await Promise.all([
        loadSessionHands(session.supabase, session.userId),
        loadViolations(session.supabase, session.userId),
      ]);
    } catch (error) {
      if (error instanceof MissingTableError) needsMigration = true;
      else throw error;
    }
  }

  const sessions = groupSessions(hands);
  const weeks = groupWeeks(sessions);
  const overall = statsFor(hands);
  const leaks = findLeaks(violations);
  const positions = resultsByPosition(hands);
  const trend = accuracyTrend(sessions).map((point) => ({
    at: point.at.toISOString(),
    accuracy: point.accuracy,
    charted: point.charted,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Hands</h1>
      </header>

      <div className="space-y-12">
        {needsMigration && (
          <MigrationNotice
            file="supabase/migrations/0003_hands.sql"
            what="The tables that store your hands do not exist yet."
          />
        )}

        {/* Importing comes first now. It is the one thing on this page you
            *do* rather than read, and a page whose action sits at the bottom
            makes you scroll past your own results to reach it. */}
        <section>
          <details open={sessions.length === 0}>
            <summary className="cursor-pointer text-sm font-semibold">
              Import a session
            </summary>
            <div className="mt-4 space-y-4">
              <HandImport signedIn={session !== null} />
              <Setup />
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Only preflop spots the chart covers are graded — opening an
                unopened pot, and facing exactly one raise. Everything else is
                left alone rather than guessed at.
              </p>
            </div>
          </details>
        </section>

        {overall.charted > 0 && (
          <AccuracyTrend
            points={trend}
            overall={{
              accuracy: overall.accuracy,
              charted: overall.charted,
              mistakes: overall.mistakes,
            }}
            hands={overall.hands}
          />
        )}

        <PositionResults results={positions} />

        {weeks.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Sessions</h2>
              <Link
                href="/hands/search"
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Find a hand →
              </Link>
            </div>
            <div className="space-y-6">
              {weeks.map((week) => (
                <Week
                  key={week.id}
                  startedAt={week.startedAt}
                  sessions={week.sessions}
                />
              ))}
            </div>
          </section>
        )}

        {/* Leaks last, and only the worst few.
            The full list was never the useful part: they are ranked, so the
            tail is by construction the stuff least worth your attention, and a
            screen of fourteen of them reads as a verdict on you rather than a
            list of things to fix. The rest stay one click away in the drill. */}
        {leaks.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                Worst leaks
                {leaks.length > TOP_LEAKS && (
                  <span className="ml-2 font-normal text-zinc-400">
                    {TOP_LEAKS} of {leaks.length}
                  </span>
                )}
              </h2>
              <Link
                href="/drill"
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Drill all →
              </Link>
            </div>
            <LeakList
              leaks={leaks.slice(0, TOP_LEAKS)}
              violations={violations}
            />
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * One week of sittings.
 *
 * The week is the unit that carries signal at this volume: a single sitting is
 * too small to say much, and an undated list of every session ever hides
 * whether last month was better than this one.
 */
function Week({
  startedAt,
  sessions,
}: {
  startedAt: Date;
  sessions: PlaySession[];
}) {
  const stats = statsFor(sessions.flatMap((s) => s.hands));

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3 border-b border-zinc-200 pb-1 dark:border-zinc-800">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          week of{" "}
          {startedAt.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
        </span>
        <span className="ml-auto text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {stats.hands} hands
          {stats.charted > 0 && ` · ${stats.accuracy.toFixed(0)}%`}
        </span>
      </div>

      <ul>
        {sessions.map((play) => (
          <li key={play.id} className="py-1">
            <SessionRow play={play} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionRow({ play }: { play: PlaySession }) {
  const stats = statsFor(play.hands);
  const label = `${play.startedAt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${stats.hands} hands`;

  return (
    <div>
      <Link
        href={`/hands/session/${play.id}`}
        className="-mx-2 flex items-baseline gap-3 rounded-lg px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <span className="text-sm font-medium">
          {play.startedAt.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
          })}
        </span>

        {/* The time distinguishes two sittings on the same day, which is what
            makes a row identifiable at all when you played twice. */}
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {play.startedAt.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {stats.hands} hands
        </span>

        {stats.charted > 0 && (
          <span
            className={cn(
              "text-xs tabular-nums",
              stats.accuracy >= 90
                ? "text-emerald-600 dark:text-emerald-400"
                : stats.accuracy >= 75
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400",
            )}
          >
            {stats.accuracy.toFixed(0)}%
          </span>
        )}

        {/* Result, deliberately quiet. Over a few hundred hands it is mostly
            variance, and putting it in bold next to accuracy invites reading it
            as the score. */}
        <span
          className={cn(
            "ml-auto text-sm tabular-nums",
            stats.netBb > 0
              ? "text-emerald-600/70 dark:text-emerald-400/70"
              : stats.netBb < 0
                ? "text-rose-600/70 dark:text-rose-400/70"
                : "text-zinc-400",
          )}
        >
          {stats.netBb > 0 ? "+" : ""}
          {stats.netBb.toFixed(1)}bb
        </span>
      </Link>

      <div className="px-2 pb-1">
        <SessionActions
          handIds={play.hands.map((h) => h.psHandId)}
          label={label}
        />
      </div>
    </div>
  );
}

/**
 * Kept, and kept collapsed.
 *
 * This is not explanation — it is the setup without which the whole page is
 * empty, and the one fact ("not retroactive") that otherwise costs you a
 * session's hands before you find out.
 */
function Setup() {
  return (
    <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <summary className="cursor-pointer text-sm">
        Turn on hand history in PokerStars
      </summary>
      <div className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Settings → Playing History → Hand History</li>
          <li>Tick Save My Hand History</li>
          <li>Tick Save in English</li>
          <li>Note the folder, then Apply</li>
        </ol>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Not retroactive — only hands played after you switch it on are saved.
        </p>
        <code className="block overflow-x-auto rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] dark:bg-zinc-800">
          %LOCALAPPDATA%\PokerStars\HandHistory\&lt;screen name&gt;
        </code>
      </div>
    </details>
  );
}
