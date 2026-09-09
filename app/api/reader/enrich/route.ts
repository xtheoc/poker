import { NextResponse } from "next/server";
import { z } from "zod";
import { MissingApiKeyError, hasApiKey } from "@/lib/ai";
import { enrich } from "@/lib/reader/ai";
import { loadBook, loadPassages, saveEnrichment } from "@/lib/reader/store";
import { optionalUser } from "@/lib/session";

/**
 * Read one portion closely and return notes to sit beside the pages.
 *
 * On demand rather than at import: enriching a sixty-portion book up front
 * would mean a long wait and paying for fifty portions you may never reach. The
 * result is cached on the passage, so it is generated once.
 *
 * The passage text comes from the database, never from the request. The client
 * has no business telling the server what the book says.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  bookId: z.string().uuid(),
  passageId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await optionalUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  if (!hasApiKey()) {
    return NextResponse.json(
      {
        error:
          "No ANTHROPIC_API_KEY is configured, so the reading notes cannot be generated.",
      },
      { status: 503 },
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
    const [book, passages] = await Promise.all([
      loadBook(session.supabase, session.userId, parsed.data.bookId),
      loadPassages(session.supabase, session.userId, parsed.data.bookId),
    ]);

    const passage = passages.find((p) => p.id === parsed.data.passageId);
    if (!book || !passage) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // Already done. Returning the cached copy keeps the client simple: it can
    // always ask, and asking twice costs nothing.
    if (passage.enrichment) {
      return NextResponse.json({ enrichment: passage.enrichment });
    }

    const enrichment = await enrich(passage.text, {
      bookTitle: book.title,
      sectionTitle: passage.sectionTitle,
    });
    if (!enrichment) {
      return NextResponse.json(
        { error: "Could not read that passage." },
        { status: 502 },
      );
    }

    await saveEnrichment(
      session.supabase,
      session.userId,
      passage.id,
      enrichment,
    );
    return NextResponse.json({ enrichment });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message =
      error instanceof Error ? error.message : "Could not read that passage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
