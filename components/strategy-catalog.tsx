import Link from "next/link";
import { ArrowRight, CircleDot } from "lucide-react";
import type { Strategy } from "@/lib/strategies";
import { isLearningStrategy } from "@/lib/strategies";

export function StrategyCatalog({ strategies }: { strategies: readonly Strategy[] }) {
  const ready = strategies.filter(isLearningStrategy);

  if (ready.length === 0) {
    return (
      <section aria-labelledby="strategies-heading" className="mt-10">
        <h2 id="strategies-heading" className="sr-only">Available strategies</h2>
        <div className="border-y border-zinc-200 py-7 dark:border-zinc-800">
          <p className="text-lg font-medium">No strategy loaded</p>
          <p className="mt-1 text-sm text-zinc-500">The learning system is ready for the first one.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="strategies-heading" className="mt-10">
      <h2 id="strategies-heading" className="sr-only">Available strategies</h2>
      <div className="grid gap-px overflow-hidden border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        {ready.map((strategy) => (
          <Link
            key={strategy.id}
            href={`/strategies/${strategy.id}`}
            className="group grid min-h-52 gap-8 bg-white p-6 transition hover:bg-zinc-50 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                <CircleDot className="size-3" aria-hidden="true" /> Active strategy
              </span>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">{strategy.name}</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{strategy.tagline}</p>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition group-hover:gap-3 group-hover:text-zinc-950 dark:group-hover:text-white">
              Open <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
