import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Strategy } from "@/lib/strategies";
import { isLearningStrategy } from "@/lib/strategies";

export function StrategyCatalog({ strategies }: { strategies: readonly Strategy[] }) {
  const ready = strategies.filter(isLearningStrategy);

  if (ready.length === 0) {
    return (
      <section aria-labelledby="strategies-heading" className="mt-12">
        <p id="strategies-heading" className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Strategies
        </p>
        <div className="mt-4 border-y border-zinc-200 py-7 dark:border-zinc-800">
          <p className="text-lg font-medium">No strategy loaded</p>
          <p className="mt-1 text-sm text-zinc-500">The learning system is ready for the first one.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="strategies-heading" className="mt-12">
      <p id="strategies-heading" className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
        Strategies
      </p>
      <div className="mt-4 grid gap-px overflow-hidden border border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
        {ready.map((strategy) => (
          <Link
            key={strategy.id}
            href={`/strategies/${strategy.id}`}
            className="group min-h-44 bg-white p-5 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <ArrowUpRight className="ml-auto h-4 w-4 text-zinc-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-950 dark:group-hover:text-white" />
            <h2 className="mt-8 text-lg font-semibold">{strategy.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">{strategy.tagline}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
