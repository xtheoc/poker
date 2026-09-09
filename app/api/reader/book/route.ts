import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MissingReaderTableError, loadBook } from "@/lib/reader/store";
import { optionalUser } from "@/lib/session";

/**
 * Rename or remove a book.
 *
 * Deleting is genuinely destructive — the passages, the summaries you wrote,
 * and the rules that book contributed all go with it, because none of them mean
 * anything without the text they came from. The confirmation lives in the
 * interface, where the title can be put in front of you; a route that simply
 * obeys is the right shape for the server half of that.
 *
 * The stored PDF is removed too. Leaving a forty-megabyte file in a private
 * bucket with nothing referencing it is the sort of debris nobody ever goes
 * back for.
 */

const Body = z.object({
  bookId: z.string().uuid(),
  action: z.enum(["rename", "delete"]),
  title: z.string().trim().min(1).max(300).optional(),
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

  const { bookId, action, title } = parsed.data;

  try {
    // Loaded first so both branches are scoped to a book this user owns, rather
    // than trusting the id that arrived in the request.
    const book = await loadBook(session.supabase, session.userId, bookId);
    if (!book) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (action === "rename") {
      if (!title) {
        return NextResponse.json(
          { error: "A book needs a name." },
          { status: 400 },
        );
      }

      const { error } = await session.supabase
        .from("book")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", bookId)
        .eq("user_id", session.userId);

      if (error) throw new Error(error.message);

      revalidatePath("/reader");
      revalidatePath(`/reader/${bookId}`);
      return NextResponse.json({ ok: true, title });
    }

    // The file goes first. Deleting the row first and failing here would leave
    // the storage path gone and the object orphaned with nothing pointing at
    // it; this way round, a failure leaves everything still linked together.
    const { error: fileError } = await session.supabase.storage
      .from("books")
      .remove([book.storagePath]);
    if (fileError) throw new Error(fileError.message);

    // Passages and notes carry `on delete cascade`, so this takes them with it.
    const { error } = await session.supabase
      .from("book")
      .delete()
      .eq("id", bookId)
      .eq("user_id", session.userId);

    if (error) throw new Error(error.message);

    revalidatePath("/reader");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MissingReaderTableError) {
      return NextResponse.json(
        {
          error: `Your database is missing something ${error.migration} adds. Run it, then try again.`,
        },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not do that.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
