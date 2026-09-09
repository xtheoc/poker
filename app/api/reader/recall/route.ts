import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasApiKey } from "@/lib/ai";
import { reviewSummary } from "@/lib/reader/ai";
import {
  MissingReaderTableError,
  loadBook,
  loadPassages,
  saveNotes,
  saveReview,
} from "@/lib/reader/store";
import { optionalUser } from "@/lib/session";

/**
 * Mark a written summary, and open the next portion once nothing is missing.
 *
 * The loop this serves: you write what the section said, it names what you left
 * out, you write again. Only when the summary covers the passage does the
 * portion close and its rules join the book's summary.
 *
 * Two safety valves, both about not trapping a reader:
 *
 * **No key, no gate.** If the model cannot be reached the portion completes on
 * the first attempt. Being locked out of your own book because a review call
 * failed would make the whole thing abandonable, which costs far more than a
 * leniently-passed section.
 *
 * **The client can force completion.** After several attempts the interface
 * offers a way through, for when the tool is wrong about a passage — a bad
 * extraction, or a section with nothing in it to recall.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  passageId: z.string().uuid(),
  bookId: z.string().uuid(),
  text: z.string().trim().min(1).max(20_000),
  /** Set when the reader has decided the review is wrong and moved on. */
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await optionalUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Write something first, even if it is thin." },
      { status: 400 },
    );
  }

  const { passageId, bookId, text, force } = parsed.data;

  try {
    const [book, passages] = await Promise.all([
      loadBook(session.supabase, session.userId, bookId),
      loadPassages(session.supabase, session.userId, bookId),
    ]);
    const passage = passages.find((p) => p.id === passageId);
    if (!book || !passage) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const attempts = passage.attempts + 1;

    // Nothing to review against: complete it and let them read on.
    if (!hasApiKey() || force) {
      await saveReview(session.supabase, session.userId, passageId, {
        text,
        attempts,
        complete: true,
      });
      revalidatePath(`/reader/${bookId}`);
      return NextResponse.json({ complete: true, missing: [], rules: [] });
    }

    const review = await reviewSummary(passage.text, text, {
      bookTitle: book.title,
      sectionTitle: passage.sectionTitle,
      attempt: attempts,
    });

    // A failed review must not cost the reader their place.
    if (!review) {
      await saveReview(session.supabase, session.userId, passageId, {
        text,
        attempts,
        complete: true,
      });
      revalidatePath(`/reader/${bookId}`);
      return NextResponse.json({ complete: true, missing: [], rules: [] });
    }

    await saveReview(session.supabase, session.userId, passageId, {
      text,
      attempts,
      complete: review.complete,
      score: review.score,
      missing: review.missing,
    });

    if (review.complete) {
      const pages =
        passage.firstPage === passage.lastPage
          ? `p${passage.firstPage}`
          : `p${passage.firstPage}-${passage.lastPage}`;

      await saveNotes(
        session.supabase,
        session.userId,
        { bookId, passageId, passageIndex: passage.index },
        review.rules,
        { sectionTitle: passage.sectionTitle, sourcePages: pages },
      );
    }

    revalidatePath(`/reader/${bookId}`);

    return NextResponse.json({
      complete: review.complete,
      missing: review.missing,
      score: review.score,
      rules: review.complete ? review.rules : [],
      attempts,
    });
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
      error instanceof Error ? error.message : "Could not save that.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
