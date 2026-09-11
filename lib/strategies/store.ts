/** Persistence for the generic strategy learning system. */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LearningProgress,
  LessonProgress,
  MasteryAttempt,
} from "./learning";

export class MissingStrategyTablesError extends Error {
  migration = "supabase/migrations/0009_strategies.sql";

  constructor() {
    super("The strategy learning tables do not exist yet.");
    this.name = "MissingStrategyTablesError";
  }
}

function missingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table/i.test(error.message ?? "")
  );
}

function fail(error: { code?: string; message: string }, context: string): never {
  if (missingTable(error)) throw new MissingStrategyTablesError();
  throw new Error(`${context}: ${error.message}`);
}

interface SetupRow {
  requirement_id: string;
  complete: boolean;
}

interface LessonRow {
  lesson_id: string;
  started_at: string | null;
  mastered_at: string | null;
}

interface AttemptRow {
  lesson_id: string;
  requirement_kind: MasteryAttempt["requirementKind"];
  requirement_id: string | null;
  score: number | null;
  duration_ms: number | null;
  payload: unknown;
  attempted_at: string;
}

export interface NewMasteryAttempt {
  lessonId: string;
  requirementKind: MasteryAttempt["requirementKind"];
  requirementId?: string;
  score?: number;
  durationMs?: number;
  /** Compact, non-authoritative context for audit and future review UX. */
  payload?: Record<string, unknown>;
}

/**
 * Persist the evidence first. Whether it satisfies a lesson belongs to the
 * manifest, and is evaluated by the caller after reloading progress.
 */
export async function recordStrategyMasteryAttempt(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
  attempt: NewMasteryAttempt,
): Promise<void> {
  const now = new Date().toISOString();
  const { error: progressError } = await supabase
    .from("strategy_lesson_progress")
    .upsert(
      {
        user_id: userId,
        strategy_id: strategyId,
        lesson_id: attempt.lessonId,
        started_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,strategy_id,lesson_id" },
    );
  if (progressError) fail(progressError, "Could not start this lesson");

  const { error } = await supabase.from("strategy_mastery_attempt").insert({
    user_id: userId,
    strategy_id: strategyId,
    lesson_id: attempt.lessonId,
    requirement_kind: attempt.requirementKind,
    requirement_id: attempt.requirementId ?? null,
    score: attempt.score ?? null,
    duration_ms: attempt.durationMs ?? null,
    payload: attempt.payload ?? {},
  });
  if (error) fail(error, "Could not save mastery evidence");
}

/** Mark the milestone after the pure map confirms all requirements have passed. */
export async function markStrategyLessonMastered(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
  lessonId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("strategy_lesson_progress")
    .upsert(
      {
        user_id: userId,
        strategy_id: strategyId,
        lesson_id: lessonId,
        mastered_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,strategy_id,lesson_id" },
    );
  if (error) fail(error, "Could not mark this lesson mastered");
}

/**
 * One read gives the pure learning-map code everything it needs. The database
 * records events and milestones; it never stores a derived "unlocked" flag.
 */
export async function loadStrategyLearningProgress(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<LearningProgress> {
  const [setupResponse, lessonResponse, attemptResponse] = await Promise.all([
    supabase
      .from("strategy_setup_check")
      .select("requirement_id, complete")
      .eq("user_id", userId)
      .eq("strategy_id", strategyId),
    supabase
      .from("strategy_lesson_progress")
      .select("lesson_id, started_at, mastered_at")
      .eq("user_id", userId)
      .eq("strategy_id", strategyId),
    supabase
      .from("strategy_mastery_attempt")
      .select("lesson_id, requirement_kind, requirement_id, score, duration_ms, payload, attempted_at")
      .eq("user_id", userId)
      .eq("strategy_id", strategyId)
      .order("attempted_at", { ascending: true }),
  ]);

  if (setupResponse.error) fail(setupResponse.error, "Could not load strategy setup");
  if (lessonResponse.error) fail(lessonResponse.error, "Could not load lesson progress");
  if (attemptResponse.error) fail(attemptResponse.error, "Could not load mastery evidence");

  const attemptsByLesson = new Map<string, MasteryAttempt[]>();
  for (const row of (attemptResponse.data ?? []) as unknown as AttemptRow[]) {
    const attempts = attemptsByLesson.get(row.lesson_id) ?? [];
    attempts.push({
      requirementKind: row.requirement_kind,
      requirementId: row.requirement_id ?? undefined,
      score: row.score ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      answers: answersFromPayload(row.payload),
      completedAt: new Date(row.attempted_at),
    });
    attemptsByLesson.set(row.lesson_id, attempts);
  }

  const lessons: LessonProgress[] = ((lessonResponse.data ?? []) as unknown as LessonRow[]).map(
    (row) => ({
      lessonId: row.lesson_id,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      masteredAt: row.mastered_at ? new Date(row.mastered_at) : null,
      attempts: attemptsByLesson.get(row.lesson_id) ?? [],
    }),
  );

  return {
    completeSetupIds: ((setupResponse.data ?? []) as unknown as SetupRow[])
      .filter((row) => row.complete)
      .map((row) => row.requirement_id),
    lessons,
  };
}

function answersFromPayload(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object" || !("answers" in payload)) return undefined;
  const answers = (payload as { answers?: unknown }).answers;
  return typeof answers === "number" && Number.isInteger(answers) && answers > 0
    ? answers
    : undefined;
}
