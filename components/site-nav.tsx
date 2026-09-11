"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's one piece of chrome.
 *
 * The strategy workspace owns learning, drills, playbook and hands. The shell
 * only provides a way back to the strategy catalogue and account settings, so
 * it does not compete with the strategy navigation beneath it.
 */

export function SiteNav({
  email,
}: {
  email: string | null;
}) {
  const pathname = usePathname();
  const active = pathname === "/" || pathname.startsWith("/strategies");

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-1 px-4 py-2">
        <Link
          href="/"
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm transition",
            active
              ? "bg-zinc-100 font-medium dark:bg-zinc-800"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
          )}
        >
          Strategies
        </Link>

        <div className="ml-auto">
          {email ? (
            <Link
              href="/settings"
              title={`Settings for ${email}`}
              aria-label="Settings"
              className="inline-flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <Settings className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white"
            >
              Not saving — sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
