"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Hand, LayoutDashboard, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { suffix: "", label: "Overview", Icon: LayoutDashboard },
  { suffix: "/learn", label: "Learn", Icon: BookOpen },
  { suffix: "/drill", label: "Drill", Icon: Target },
  { suffix: "/playbook", label: "Playbook", Icon: ClipboardList },
  { suffix: "/hands", label: "Hands", Icon: Hand },
] as const;

/** The small, strategy-local navigation shared by every learning surface. */
export function StrategyNav({
  strategyId,
  strategyName,
}: {
  strategyId: string;
  strategyName: string;
}) {
  const pathname = usePathname();
  const root = `/strategies/${strategyId}`;

  return (
    <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:pb-6">
      <Link
        href={root}
        className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 transition hover:text-zinc-950 dark:hover:text-white"
      >
        {strategyName}
      </Link>
      <nav aria-label={`${strategyName} navigation`} className="mt-4 flex items-center justify-between gap-1 overflow-x-auto pb-0.5 sm:gap-2 sm:justify-start">
        {ITEMS.map(({ suffix, label, Icon }) => {
          const href = `${root}${suffix}`;
          const active = suffix
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === root;
          return (
            <Link
              key={suffix || "overview"}
              href={href}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 border-b-2 px-2.5 py-2 text-sm transition sm:px-3 sm:py-2",
                active
                  ? "border-zinc-950 font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200",
              )}
            >
              <Icon className="size-4 sm:size-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
