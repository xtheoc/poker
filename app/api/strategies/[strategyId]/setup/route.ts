import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearningStrategy } from "@/lib/strategies";
import { optionalUser } from "@/lib/session";

const Body = z.object({
  requirementId: z.string().min(1).max(120),
  complete: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/strategies/[strategyId]/setup">,
) {
  const { strategyId } = await params;
  const strategy = getLearningStrategy(strategyId);
  if (!strategy) return NextResponse.json({ error: "Unknown strategy." }, { status: 404 });

  const session = await optionalUser();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That setup change did not look right." }, { status: 400 });
  }
  if (!strategy.learning.setup.some((item) => item.id === parsed.data.requirementId)) {
    return NextResponse.json({ error: "That requirement is not part of this strategy." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await session.supabase.from("strategy_setup_check").upsert(
    {
      user_id: session.userId,
      strategy_id: strategy.id,
      requirement_id: parsed.data.requirementId,
      complete: parsed.data.complete,
      completed_at: parsed.data.complete ? now : null,
      updated_at: now,
    },
    { onConflict: "user_id,strategy_id,requirement_id" },
  );
  if (error) {
    return NextResponse.json({ error: `Could not save setup: ${error.message}` }, { status: 500 });
  }

  revalidatePath(`/strategies/${strategy.id}`);
  revalidatePath(`/strategies/${strategy.id}/setup`);
  revalidatePath(`/strategies/${strategy.id}/learn`);
  return NextResponse.json({ ok: true });
}
