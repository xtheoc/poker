import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { MigrationNotice } from "@/components/migration-notice";
import { StrategyNav } from "@/components/strategy-nav";
import { StrategySetup } from "@/components/strategy-setup";
import { getLearningStrategy } from "@/lib/strategies";
import { strategyProgressPageData } from "@/lib/strategies/progress-server";

export default async function StrategySetupPage({
  params,
}: PageProps<"/strategies/[strategyId]/setup">) {
  const { strategyId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) notFound();

  const { progress, signedIn, migrationMissing } = await strategyProgressPageData(strategy.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <div className="mt-10 max-w-xl">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Before you start
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Setup</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">Confirm these once. The course opens when the required setup is ready.</p>
      </div>

      {migrationMissing ? (
        <div className="mt-10">
          <MigrationNotice
            file="supabase/migrations/0009_strategies.sql"
            what="Setup completion needs the strategy learning tables."
          />
        </div>
      ) : signedIn ? (
        <div className="mt-10">
          <StrategySetup
            strategyId={strategy.id}
            requirements={strategy.learning.setup}
            completedIds={progress.completeSetupIds}
          />
        </div>
      ) : (
        <p className="mt-10 border-y border-zinc-200 py-6 text-sm text-zinc-500 dark:border-zinc-800">Sign in to save setup completion.</p>
      )}
    </main>
  );
}
