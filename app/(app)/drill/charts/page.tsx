import Link from "next/link";
import { PreflopTrainer } from "@/components/preflop-trainer";
import { RangeList } from "@/components/range-list";
import { BEGINNER_6MAX } from "@/lib/poker/charts/beginner-6max";

export const metadata = { title: "Charts" };

/**
 * The reference, and the slower per-spot drill.
 *
 * Separate from the quickfire page on purpose. This is where you come to look
 * something up or work one spot deliberately; that is where you come to be
 * tested. Mixing the two makes the test easier and the study shallower.
 */
export default function ChartsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Charts</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Look a spot up, or drill one spot at a time.{" "}
          <Link href="/drill" className="underline">
            Back to the drill
          </Link>
        </p>
      </header>

      <PreflopTrainer chartSet={BEGINNER_6MAX} />

      <div className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <RangeList chartSet={BEGINNER_6MAX} />
        <p className="mt-6 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
          {BEGINNER_6MAX.name} · version {BEGINNER_6MAX.version}
        </p>
      </div>
    </main>
  );
}
