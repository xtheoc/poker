"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The app's one piece of chrome.
 *
 * It does two jobs. It says whether you are signed in — which the app otherwise
 * cannot show, since everything works signed out and simply forgets. And it
 * says what is *waiting*: four inert links tell you where you can go and
 * nothing about whether there is any reason to, which left the state that
 * decides where to go next somewhere you had to visit to discover.
 *
 * The dots are deliberately not counts. A number invites you to clear it, and
 * the reading allowance in particular is a ceiling — turning it into a score to
 * run down would invert the whole point of having one.
 */

export interface NavStatus {
  /** Leaks worth drilling right now. */
  leaks: number;
  /** A book part-read. */
  reading: boolean;
  /** Today's reading allowance is spent. */
  readingDone: boolean;
}

const LINKS = [
  { href: "/hands", label: "Hands" },
  { href: "/drill", label: "Drill" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

export function SiteNav({
  email,
  status,
}: {
  email: string | null;
  status?: NavStatus;
}) {
  const pathname = usePathname();

  const dotFor = (href: string): string | null => {
    if (!status) return null;
    if (href === "/drill" && status.leaks > 0) return "bg-amber-500";
    if (href === "/library" && status.reading) {
      // Grey once the day's reading is done: still in progress, nothing more to
      // do about it today.
      return status.readingDone ? "bg-zinc-500" : "bg-emerald-500";
    }
    return null;
  };

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav className="mx-auto flex w-full max-w-2xl items-center gap-1 px-4 py-2">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          const dot = dotFor(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative rounded-md px-2.5 py-1.5 text-sm transition",
                active
                  ? "bg-zinc-100 font-medium dark:bg-zinc-800"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              {link.label}
              {dot && (
                <span
                  className={cn(
                    "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                    dot,
                  )}
                />
              )}
            </Link>
          );
        })}

        <div className="ml-auto">
          {email ? (
            <Link
              href="/settings"
              title={email}
              className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300"
            >
              {email.split("@")[0]}
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
