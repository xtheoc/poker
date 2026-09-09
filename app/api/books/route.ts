import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MissingReadingTableError, saveReading } from "@/lib/reading-store";
import { optionalUser } from "@/lib/session";

/**
 * Start a book, finish one, or put one down.
 *
 * One endpoint for all three, because they are one thing: an edit to a single
 * record saying where a book stands with you. The verdict is optional in the
 * schema and only meaningful when a book is being closed — it is what lets the
 * next recommendation differ from the last.
 */

const Body = z.object({
  bookId: z.string().max(100).nullish(),
  title: z.string().min(1).max(300),
  author: z.string().max(200).nullish(),
  status: z.enum(["reading", "finished", "abandoned"]),
  verdict: z.enum(["right", "too-basic", "too-hard", "bounced"]).nullish(),
  note: z.string().max(2000).nullish(),
});

export async function POST(request: Request) {
  const session = await optionalUser();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in first — there is nowhere to save this otherwise." },
      { status: 401 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That did not look right." },
      { status: 400 },
    );
  }

  try {
    await saveReading(session.supabase, session.userId, parsed.data);
    // The shelf and the shortlist are server-rendered, so they have to be told
    // the rows underneath them moved.
    // The librarian lives on /library now, merged with the shelf.
    revalidatePath("/library");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MissingReadingTableError) {
      return NextResponse.json(
        {
          error:
            "The reading table does not exist yet. Run supabase/migrations/0004_reading.sql in the Supabase SQL editor, then try again.",
        },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not save that.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
