import Link from "next/link";
import { HudShortlist } from "@/components/hud-shortlist";
import { PlaystyleCard } from "@/components/playstyle-card";

export const metadata = { title: "Playstyle" };

/**
 * The conditions, on their own page.
 *
 * Settings is a narrow column of form fields and belongs that way; this is
 * several hundred decision rules and needs the room. Settings keeps the six
 * that are always true and links here — the same shape it already uses for the
 * ranges.
 *
 * No `requireUser` on purpose. Nothing here is yours: it is the strategy the
 * app grades everyone against, and gating it behind a session would only mean
 * you cannot open it on a phone that has been signed out. Every page that reads
 * *your* data still requires one.
 */
export default function PlaystylePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Playstyle</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-500 dark:text-zinc-400">
          Everything the charts cannot say: the sizings, the conditions, the
          reads that change the answer, and the handful of things never to do.
        </p>
        <p className="mt-2 max-w-prose text-xs text-zinc-500 dark:text-zinc-400">
          Opening ranges are deliberately not here — they are in{" "}
          <Link href="/drill/charts" className="underline">
            the charts
          </Link>
          , where they can be drilled. Two copies of a range is two things to
          disagree with each other.
        </p>
      </header>

      {/* Before the strategy, because it is a setup step: configure the badge
          once, then everything below can lean on what it shows. */}
      <HudShortlist />

      <PlaystyleCard />

      <footer className="mt-12 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <Link
          href="/settings"
          className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Back to settings
        </Link>
      </footer>
    </main>
  );
}
