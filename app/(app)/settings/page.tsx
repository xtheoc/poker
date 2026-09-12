import Link from "next/link";
import { RegradeHands } from "@/components/regrade-hands";
import { SettingsForm } from "@/components/settings-form";
import { GlobalSignOut } from "@/components/global-signout";
import { PLAYSTYLE } from "@/lib/playstyle";
import { BEGINNER_6MAX } from "@/lib/poker/charts/beginner-6max";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Settings" };

/**
 * The four things the app was deciding for you.
 *
 * These columns have existed since the first migration with sensible defaults
 * and no editor, which is a quiet way of being wrong: the reading limit was 12
 * because 12 was the default, and the timezone was UTC because nobody asked.
 * Both change behaviour you would otherwise have no way to explain.
 */
export default async function SettingsPage() {
  const session = await requireUser();
  const profile = session.profile;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <SettingsForm
        profile={{
          dailyPages: profile?.daily_pages ?? 12,
          timezone: profile?.timezone ?? "UTC",
          bigBlind: Number(profile?.big_blind ?? 0.02),
          pokerstarsAlias: profile?.pokerstars_alias ?? "",
        }}
      />

      <div className="mt-10">
        <GlobalSignOut />
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">The chart you are graded against</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {BEGINNER_6MAX.name}, version {BEGINNER_6MAX.version} —{" "}
          {BEGINNER_6MAX.nodes.length} spots. Said &quot;opening spots&quot;
          until version 9, which was right while every node was an open and
          stopped being right the moment facing a raise arrived.
        </p>
        <Link
          href="/drill/charts"
          className="mt-3 inline-block rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Read the ranges
        </Link>
      </div>

      {/* A contents list rather than an excerpt. This used to inline the six
          "always true" rules, which were cut from the sheet for being things
          the reader already knew — so the excerpt went with them. Section
          titles are more useful anyway: they say what is in there. */}
      <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">
          The playstyle you are graded against
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Everything the charts cannot say — the sizings, the conditions, the
          reads that change the answer.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {PLAYSTYLE.map((section) => (
            <li
              key={section.id}
              className="text-xs text-zinc-600 dark:text-zinc-400"
            >
              {section.title}
            </li>
          ))}
        </ul>
        <Link
          href="/playstyle"
          className="mt-4 inline-block rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Read the whole playstyle
        </Link>
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <RegradeHands chartName={BEGINNER_6MAX.name} />
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Signed in as {session.email}
        </p>
        <form action="/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
