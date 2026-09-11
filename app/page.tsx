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
export default function Home() {
  const strategies = getAllStrategies();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Poker</h1>

      <StrategyCatalog strategies={strategies} />

    </main>
  );
}
