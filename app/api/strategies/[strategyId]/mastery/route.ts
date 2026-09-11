import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearningStrategy } from "@/lib/strategies";
import { learningMap } from "@/lib/strategies/learning";
import {
  loadStrategyLearningProgress,
  markStrategyLessonMastered,
  recordStrategyMasteryAttempt,
} from "@/lib/strategies/store";
import { optionalUser } from "@/lib/session";

const Body = z.object({
  lessonId: z.string().min(1).max(120),
  drillId: z.string().min(1).max(120),
  score: z.number().finite().min(0).max(100),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  answers: z.number().int().min(1).max(500).optional(),
});

/**
 * A client reports a finished drill; the server decides whether that evidence
 * belongs to the current available lesson and whether it unlocks anything.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/strategies/[strategyId]/mastery">,
) {
  const { strategyId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) return NextResponse.json({ error: "Unknown strategy." }, { status: 404 });

  const session = await optionalUser();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That drill result did not look right." }, { status: 400 });
  }

  const lesson = strategy.learning.lessons.find((item) => item.id === parsed.data.lessonId);
  if (!lesson) return NextResponse.json({ error: "Unknown lesson." }, { status: 404 });
  const requirement = lesson.mastery.find(
    (item): item is Extract<typeof item, { kind: "drill" }> =>
      item.kind === "drill" && item.drillId === parsed.data.drillId,
  );
  if (!requirement) {
    return NextResponse.json({ error: "That drill does not prove this lesson." }, { status: 400 });
  }

  const before = await loadStrategyLearningProgress(
    session.supabase,
    session.userId,
    strategy.id,
  );
  const itemBefore = learningMap(strategy.learning, before).find(
    (item) => item.lesson.id === lesson.id);
  if (!itemBefore || itemBefore.state === "locked") {
    return NextResponse.json({ error: "Master the previous subject first." }, { status: 409 });
  }
  if (itemBefore.state === "mastered") {
    return NextResponse.json({ mastered: true, alreadyMastered: true });
  }

  await recordStrategyMasteryAttempt(session.supabase, session.userId, strategy.id, {
    lessonId: lesson.id,
    requirementKind: "drill",
    requirementId: requirement.drillId,
    score: parsed.data.score,
    durationMs: parsed.data.durationMs,
    payload: { answers: parsed.data.answers ?? null },
  });

  const after = await loadStrategyLearningProgress(
    session.supabase,
    session.userId,
    strategy.id,
  );
  const itemAfter = learningMap(strategy.learning, after).find(
    (item) => item.lesson.id === lesson.id);
  const mastered = itemAfter?.requirementsMet === itemAfter?.requirementCount;
  if (mastered) {
    await markStrategyLessonMastered(
      session.supabase,
      session.userId,
      strategy.id,
      lesson.id,
    );
  }

  revalidatePath(`/strategies/${strategy.id}`);
  revalidatePath(`/strategies/${strategy.id}/learn`);
  revalidatePath(`/strategies/${strategy.id}/playbook`);
  revalidatePath(`/strategies/${strategy.id}/drill`);
  revalidatePath(`/strategies/${strategy.id}/learn/${lesson.id}`);
  return NextResponse.json({
    mastered,
    requirementsMet: itemAfter?.requirementsMet ?? 0,
    requirementCount: itemAfter?.requirementCount ?? lesson.mastery.length,
  });
}
