import Link from "next/link";
import { notFound } from "next/navigation";
import { MigrationNotice } from "@/components/migration-notice";
import { StrategyPreflopDrill } from "@/components/strategy-preflop-drill";
import {
  StrategyPracticeCircuit,
  type CircuitDrillId,
} from "@/components/strategy-practice-circuit";
import { StrategyNav } from "@/components/strategy-nav";
import { QuickfireDrill } from "@/components/quickfire-drill";
import { dealHud } from "@/lib/hud/deal";
import type { ChartSet, Scenario } from "@/lib/poker/charts";
import { getLearningStrategy } from "@/lib/strategies";
import { dealContextualPreflopSession } from "@/lib/strategies/ctm-contextual";
import { dealCtmSizingSession } from "@/lib/strategies/ctm-sizing";
import type { LeakTarget } from "@/lib/poker/leak-drill";
import {
  loadStrategyViolations,
  MissingStrategyReviewTablesError,
} from "@/lib/strategies/hand-review";
import { learningMap, nextLesson } from "@/lib/strategies/learning";
import { strategyMistakeTargets } from "@/lib/strategies/mistake-drill";
import { strategyProgressPageData } from "@/lib/strategies/progress-server";
import { cycleLeakSpots } from "@/lib/poker/leak-drill";
import { optionalUser } from "@/lib/session";

const SUPPORTED_DRILLS = new Set([
  "player-types",
  "open-ranges",
  "open-sizing",
  "facing-open",
  "squeeze",
  "facing-3bet",
  "facing-4bet",
  "flop-plan",
]);

const PREFLOP_DRILLS = new Set<CircuitDrillId>([
  "player-types",
  "open-ranges",
  "open-sizing",
  "facing-open",
  "squeeze",
  "facing-3bet",
  "facing-4bet",
]);

const SCENARIO_FOR_DRILL: Partial<Record<string, Scenario>> = {
  "facing-open": "vs-rfi",
  squeeze: "squeeze",
  "facing-3bet": "vs-3bet",
  "facing-4bet": "vs-4bet",
};

function masteryLabel(requirement: {
  minimumRuns: number;
  minimumAnswers?: number;
}): string {
  const run = requirement.minimumAnswers
    ? `${requirement.minimumAnswers} clean answers`
    : "a clean run";
  return requirement.minimumRuns === 1
    ? run
    : `${requirement.minimumRuns} runs of ${run}`;
}

function withScenario(chartSet: ChartSet, scenario: Scenario): ChartSet {
  return {
    ...chartSet,
    nodes: chartSet.nodes.filter((node) => node.key.scenario === scenario),
  };
}

export default async function StrategyDrillPage({
  params,
  searchParams,
}: PageProps<"/strategies/[strategyId]/drill">) {
  const { strategyId } = await params;
  const { lesson: requestedLesson, mistakes, exercise } = await searchParams;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) notFound();

  const { progress, signedIn, migrationMissing } = await strategyProgressPageData(
    strategy.id,
  );
  if (migrationMissing) {
    return <MigrationNotice file="0009_strategies.sql" what="strategy learning progress" />;
  }
  if (!signedIn) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in to learn</h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Your completed drills unlock the next lesson and build your playbook.
        </p>
        <Link className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/login">
          Sign in
        </Link>
      </main>
    );
  }

  const session = await optionalUser();
  let mistakeTargets: LeakTarget[] = [];
  let reviewMigrationMissing = false;
  if (session) {
    try {
      const violations = await loadStrategyViolations(
        session.supabase,
        session.userId,
        strategy.id,
      );
      mistakeTargets = strategyMistakeTargets(violations);
    } catch (error) {
      if (error instanceof MissingStrategyReviewTablesError) reviewMigrationMissing = true;
      else throw error;
    }
  }
  if (reviewMigrationMissing) {
    return <MigrationNotice file="0010_strategy_hand_reviews.sql" what="strategy hand review" />;
  }

  if (mistakes !== undefined) {
    if (mistakeTargets.length === 0) {
      return (
        <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
          <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
          <div className="mt-12 border-y border-zinc-200 py-12 text-center dark:border-zinc-800">
            <h1 className="text-3xl font-semibold tracking-tight">No mistakes yet</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Imported strategy mistakes will appear here as soon as they are found.
            </p>
            <Link
              href={`/strategies/${strategy.id}/drill`}
              className="mt-7 inline-block text-sm font-medium underline underline-offset-4"
            >
              Practice drills
            </Link>
          </div>
        </main>
      );
    }

    const spots = cycleLeakSpots(strategy.chartSet, mistakeTargets, 20);

    return (
      <main className="mx-auto w-full max-w-md px-5 py-8 sm:px-8 sm:py-10">
        <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
        <div className="mt-10">
          <p className="mb-7 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Your mistakes
          </p>
          <QuickfireDrill
            chartSet={strategy.chartSet}
            initialSpots={spots}
            signedIn
            targets={mistakeTargets}
            persistReviews={false}
            continueAfterMiss
          />
        </div>
      </main>
    );
  }

  const map = learningMap(strategy.learning, progress);
  const requested =
    typeof requestedLesson === "string"
      ? map.find((item) => item.lesson.id === requestedLesson)
      : undefined;
  const active =
    requested && requested.state !== "locked"
      ? requested
      : nextLesson(strategy.learning, progress);

  const availableDrills = map.flatMap((item) => {
    if (item.state === "locked") return [];
    const requirement = item.lesson.mastery.find(
      (candidate): candidate is Extract<typeof candidate, { kind: "drill" }> =>
        candidate.kind === "drill" && SUPPORTED_DRILLS.has(candidate.drillId),
    );
    if (!requirement) return [];
    const drill = strategy.learning.drills.find(
      (candidate) => candidate.id === requirement.drillId,
    );
    return drill ? [{ item, requirement, drill }] : [];
  });

  const circuitDrills = availableDrills.map(({ drill }) => drill.id as CircuitDrillId);
  const preflopCircuit = circuitDrills.filter((drill) => PREFLOP_DRILLS.has(drill));

  if (typeof exercise === "string") {
    const drills = exercise === "preflop" ? preflopCircuit : circuitDrills;
    if (drills.length > 0) {
      const rangeNodes = strategy.chartSet.nodes.filter(
        (node) => node.key.scenario === "rfi" && node.key.position !== "BB",
      );
      return (
        <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
          <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
          <div className="mt-10">
            <StrategyPracticeCircuit
              chartSet={strategy.chartSet}
              drills={drills}
              initialHud={dealHud()}
              rangeNodes={rangeNodes}
              initialSizing={dealCtmSizingSession(15)}
              contextual={{
                "facing-open": dealContextualPreflopSession(24, "vs-rfi"),
                squeeze: dealContextualPreflopSession(24, "squeeze"),
                "facing-3bet": dealContextualPreflopSession(24, "vs-3bet"),
                "facing-4bet": dealContextualPreflopSession(24, "vs-4bet"),
              }}
            />
          </div>
        </main>
      );
    }
  }

  if (requestedLesson === undefined && availableDrills.length > 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
        <div className="mt-10 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Practice
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Drills</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">Run the whole sequence, or train one skill in isolation.</p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {preflopCircuit.length > 0 && (
            <Link href={`/strategies/${strategy.id}/drill?exercise=preflop`} className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-600">
              <p className="font-medium">Pre-flop exercise</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Every opened pre-flop subject, one by one.</p>
            </Link>
          )}
          {circuitDrills.length > preflopCircuit.length && (
            <Link href={`/strategies/${strategy.id}/drill?exercise=all`} className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-600">
              <p className="font-medium">Everything unlocked</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Run pre-flop, then every unlocked post-flop subject.</p>
            </Link>
          )}
        </div>

        <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {mistakeTargets.length > 0 && (
            <Link
              href={`/strategies/${strategy.id}/drill?mistakes=1`}
              className="group grid gap-3 py-6 transition sm:grid-cols-[2rem_1fr_auto] sm:items-center"
            >
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">00</span>
              <div>
                <p className="font-medium">Your mistakes</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Practice every verified mistake, without a daily limit.
                </p>
              </div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {mistakeTargets.length} spots
              </span>
            </Link>
          )}
          {availableDrills.map(({ item, requirement, drill }, index) => {
            const current = active?.lesson.id === item.lesson.id;
            return (
              <Link
                key={item.lesson.id}
                href={`/strategies/${strategy.id}/drill?lesson=${item.lesson.id}`}
                className="group grid gap-3 py-6 transition sm:grid-cols-[2rem_1fr_auto] sm:items-center"
              >
                <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-medium">{drill.label}</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {drill.description}
                  </p>
                </div>
                <span className={
                  current
                    ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    : "text-xs text-zinc-400 dark:text-zinc-500"
                }>
                  {current ? masteryLabel(requirement) : "Practice"}
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    );
  }

  if (!active) {
    const needsSetup = map.some((item) => item.state === "locked");
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
        <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
        <h1 className="text-3xl font-semibold tracking-tight">
          {needsSetup ? "Finish setup first" : "Preflop complete"}
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          {needsSetup
            ? "The learning map opens once the required study setup is confirmed."
            : "Every preflop subject in this strategy is mastered."}
        </p>
        <Link
          className="mt-6 inline-block text-sm font-medium underline underline-offset-4"
          href={`/strategies/${strategy.id}/${needsSetup ? "setup" : "playbook"}`}
        >
          {needsSetup ? "Open setup" : "Open playbook"}
        </Link>
      </main>
    );
  }

  const requirement = active.lesson.mastery.find(
    (item): item is Extract<typeof item, { kind: "drill" }> =>
      item.kind === "drill" && SUPPORTED_DRILLS.has(item.drillId),
  );
  if (!requirement) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
        <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
        <h1 className="text-3xl font-semibold tracking-tight">Coming next</h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          This lesson needs a postflop exercise, which is not built yet.
        </p>
      </main>
    );
  }

  const scenario = SCENARIO_FOR_DRILL[requirement.drillId];
  const chartSet = scenario
    ? withScenario(strategy.chartSet, scenario)
    : strategy.chartSet;
  const rangeNodes = strategy.chartSet.nodes.filter(
    (node) => node.key.scenario === "rfi" && node.key.position !== "BB",
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <StrategyNav strategyId={strategy.id} strategyName={strategy.name} />
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            {strategy.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {active.lesson.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {active.lesson.summary}
          </p>
        </div>
        <Link
          href={`/strategies/${strategy.id}/learn/${active.lesson.id}`}
          className="shrink-0 text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Lesson
        </Link>
      </div>

      <div className="mt-10">
        <StrategyPreflopDrill
          strategyId={strategy.id}
          lessonId={active.lesson.id}
          drillId={requirement.drillId}
          chartSet={chartSet}
          initialHud={requirement.drillId === "player-types" ? dealHud() : undefined}
          initialContextual={
            scenario ? dealContextualPreflopSession(24, scenario) : undefined
          }
          rangeNodes={requirement.drillId === "open-ranges" ? rangeNodes : undefined}
          initialSizing={
            requirement.drillId === "open-sizing"
              ? dealCtmSizingSession(15)
              : undefined
          }
          masteryAnswers={requirement.minimumAnswers}
        />
      </div>
    </main>
  );
}
