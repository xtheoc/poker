import Link from "next/link";

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
  return (
    <main className="mx-auto w-full max-w-md px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Poker</h1>

      <nav className="mt-10 flex flex-col">
        {PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="border-b border-zinc-200 py-4 text-lg transition hover:pl-2 dark:border-zinc-800"
          >
            {page.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
