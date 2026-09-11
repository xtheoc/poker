import { StrategyCatalog } from "@/components/strategy-catalog";
import { SiteNav } from "@/components/site-nav";
import { getAllStrategies } from "@/lib/strategies";
import { optionalUser } from "@/lib/session";

/**
 * The index.
 *
 * Strategies are the product. The catalogue is intentionally short and takes
 * the learner straight into the currently active strategy rather than making
 * a generic dashboard compete with its workspace.
 */
export default async function Home() {
  const strategies = getAllStrategies();
  const session = await optionalUser();

  return (
    <>
      <SiteNav email={session?.email ?? null} />
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="max-w-2xl border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Poker study</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Strategies</h1>
        </header>
        <StrategyCatalog strategies={strategies} />
      </main>
    </>
  );
}
