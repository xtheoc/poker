import Link from "next/link";
import type { Leak, LeakConfidence, Violation } from "@/lib/leaks";
import { cn } from "@/lib/utils";

/**
 * Leaks, with the hands that prove them.
 *
 * The evidence is the product. "You call too wide in the small blind" is an
 * assertion; the seven hands where you did it is a finding, and clicking
 * through to replay one is what actually changes the next session. So every
 * leak here opens onto real hand numbers rather than a summary.
 *
 * A server component: the only interaction is a native `<details>`, and making
 * it a client component would ship the whole leak list to the browser twice.
 */

const CONFIDENCE_STYLES: Record<LeakConfidence, string> = {
  confirmed: "bg-rose-600 text-white",
  likely: "bg-amber-500 text-white",
  watching: "bg-zinc-400 text-white dark:bg-zinc-600",
};

export function LeakList({
  leaks,
  violations,
  limit = 8,
  drillHref,
}: {
  leaks: readonly Leak[];
  violations: readonly Violation[];
  /** Evidence hands shown before collapsing to a count. */
  limit?: number;
  /** Optional strategy-local practice destination for a leak. */
  drillHref?: (leak: Leak) => string;
}) {
  if (leaks.length === 0) return null;

  return (
    <div className="space-y-2">
      {leaks.map((leak) => (
        <LeakCard
          key={leak.id}
          leak={leak}
          violations={violations}
          limit={limit}
          drillHref={drillHref?.(leak)}
        />
      ))}
    </div>
  );
}

function LeakCard({
  leak,
  violations,
  limit,
  drillHref,
}: {
  leak: Leak;
  violations: readonly Violation[];
  limit: number;
  drillHref?: string;
}) {
  const evidence = violations.filter(
    (v) => v.nodeId === leak.nodeId && v.kind === leak.kind,
  );

  return (
    <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <summary className="cursor-pointer">
        <span className="font-medium">{leak.label}</span>
        <span
          className={cn(
            "ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            CONFIDENCE_STYLES[leak.confidence],
          )}
        >
          {leak.confidence}
        </span>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {leak.instances} {leak.instances === 1 ? "time" : "times"} across{" "}
          {leak.sessions} {leak.sessions === 1 ? "session" : "sessions"}
          {leak.totalCostBb !== undefined &&
            ` · ${leak.totalCostBb.toFixed(2)}bb given up`}
        </p>
      </summary>

      <div className="mt-3">
        {/* The point of finding a leak is to stop having it, and until now the
            only route from a diagnosis to practice was the whole rotation.
            `encodeURIComponent` is not decoration here: a leak id contains a
            `#`, which a browser would otherwise read as a fragment and never
            send to the server. */}
        <Link
          href={drillHref ?? `/drill?leak=${encodeURIComponent(leak.id)}`}
          className="inline-block rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Drill this spot →
        </Link>

        <div className="mt-3">
          <ul className="space-y-1">
            {evidence.slice(0, limit).map((v, i) => (
              <li key={`${v.handId}-${i}`}>
                <Link
                  href={`/hands/hand/${v.handId}`}
                  className="flex flex-wrap items-baseline gap-2 rounded-md py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="font-mono font-medium">{v.hand}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    you {v.chosen}ed, chart says {v.expected}
                  </span>
                  <span className="ml-auto text-zinc-400 dark:text-zinc-500">
                    replay →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {evidence.length > limit && (
            <p className="mt-1 text-xs text-zinc-400">
              and {evidence.length - limit} more
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
