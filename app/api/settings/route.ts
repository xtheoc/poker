import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { optionalUser } from "@/lib/session";

/**
 * The handful of facts the app needs about you.
 *
 * Every one of these already existed as a column with a default and no way to
 * change it, which meant the app had quietly decided four things on your
 * behalf: how much you may read in a day, which day "today" is, what a big
 * blind is worth, and which seat at the table is yours.
 *
 * Timezone is the least obvious and the most annoying when wrong: the daily
 * reading limit resets at *your* midnight, so a wrong timezone silently moves
 * when a day begins.
 */

const Body = z.object({
  dailyPages: z.number().int().min(1).max(200).optional(),
  timezone: z.string().min(1).max(64).optional(),
  bigBlind: z.number().positive().max(1000).optional(),
  pokerstarsAlias: z.string().trim().max(64).nullish(),
});

export async function POST(request: Request) {
  const session = await optionalUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That did not look right." },
      { status: 400 },
    );
  }

  const { dailyPages, timezone, bigBlind, pokerstarsAlias } = parsed.data;

  // A timezone the browser invented but this runtime does not recognise would
  // silently break every "today" in the app, so it is checked rather than
  // trusted.
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    } catch {
      return NextResponse.json(
        { error: "That timezone is not one this server knows." },
        { status: 400 },
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (dailyPages !== undefined) patch.daily_pages = dailyPages;
  if (timezone !== undefined) patch.timezone = timezone;
  if (bigBlind !== undefined) patch.big_blind = bigBlind;
  if (pokerstarsAlias !== undefined) {
    patch.pokerstars_alias = pokerstarsAlias || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await session.supabase
    .from("profiles")
    .update(patch)
    .eq("id", session.userId);

  if (error) {
    // `daily_pages` arrived in a migration later than the table itself, so a
    // missing column here has one specific and fixable cause.
    const missingColumn = /column .* does not exist/i.test(error.message);
    return NextResponse.json(
      {
        error: missingColumn
          ? "Your profile table is out of date. Run supabase/migrations/0007_reading_limit.sql, then try again."
          : error.message,
      },
      { status: missingColumn ? 503 : 500 },
    );
  }

  revalidatePath("/settings");
  return NextResponse.json({ ok: true });
}
