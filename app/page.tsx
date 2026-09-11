import Link from "next/link";
import { StrategyCatalog } from "@/components/strategy-catalog";
import { getAllStrategies } from "@/lib/strategies";

/**
 * The index.
 *
 * Four links and nothing else. It used to carry a paragraph per feature, which
 * is how it came to assert that hand review "runs in your browser — nothing is
 * uploaded" for a fortnight after that stopped being true. A description of
 * something you are one click away from opening is a liability, not a service.
 */
const PAGES = [
  { href: "/hands", label: "Hands" },
  { href: "/drill", label: "Drill" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

export default function Home() {
  const strategies = getAllStrategies();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Poker</h1>

      <StrategyCatalog strategies={strategies} />

      <nav aria-label="Workspace" className="mt-14 max-w-md">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Workspace</p>
        {PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="group flex items-center justify-between border-b border-zinc-200 py-4 text-base transition hover:pl-1 dark:border-zinc-800"
          >
            {page.label}
            <span className="text-zinc-400 transition group-hover:translate-x-0.5">→</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
