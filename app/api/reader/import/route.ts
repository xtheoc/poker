import { NextResponse } from "next/server";
import { z } from "zod";
import { hasApiKey } from "@/lib/ai";
import { inferSections } from "@/lib/reader/ai";
import {
  type OutlineEntry,
  type Section,
  outlineProbe,
  portionsForSections,
  sectionsFromOutline,
} from "@/lib/reader/sections";
import {
  MissingReaderTableError,
  createBook,
  markBook,
  savePassages,
} from "@/lib/reader/store";
import { typesetBook } from "@/lib/reader/typeset";
import { optionalUser } from "@/lib/session";

/**
 * Turn an uploaded PDF into a sectioned book.
 *
 * The browser uploads the file straight to private storage and calls this with
 * the path. Everything expensive happens here: extraction, sectioning, and the
 * split into portions.
 *
 * Sectioning is tried three ways, best first — the book's own outline, then the
 * model, then plain word count. The order matters: a published PDF usually
 * carries real chapter bookmarks, and no inference will beat the structure the
 * author actually wrote.
 */

// pdfjs needs real Node APIs, so this cannot run on the edge runtime.
export const runtime = "nodejs";
// Extraction plus a sectioning call on a long book takes minutes.
export const maxDuration = 300;

const Body = z.object({
  storagePath: z.string().min(1).max(500),
  title: z.string().min(1).max(300),
  author: z.string().max(200).nullish(),
  curriculumId: z.string().max(100).nullish(),
});

interface Extracted {
  pages: string[];
  outline: OutlineEntry[];
  /** One-based pages that contain an image. */
  figurePages: Set<number>;
}

/**
 * Pull the text and the outline out of a PDF.
 *
 * Text items arrive as positioned fragments rather than lines, so they are
 * grouped by y-coordinate. Without that, a two-column page or a table collapses
 * into a single run-on line and every heading detection fails.
 */
async function extract(data: Uint8Array): Promise<Extracted> {
  // Imported lazily and by path: the main `pdfjs-dist` entry assumes a DOM, and
  // the legacy bundle is the one that runs under Node.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // No worker configured, so the legacy build runs on this thread — which is
  // what we want on a server. `standardFontDataUrl` is deliberately unset: it
  // affects glyph *rendering*, and nothing is rendered here.
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;

  const pages: string[] = [];
  const figurePages = new Set<number>();

  // The drawing operations that put a picture on a page. A results table, a
  // range grid or a board diagram is very often one of these rather than text,
  // and there is no way to tell from the extracted words that anything is
  // missing — which is exactly why it has to be detected here.
  const IMAGE_OPS = new Set<number>([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
  ]);

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);

    try {
      const ops = await page.getOperatorList();
      if (ops.fnArray.some((fn: number) => IMAGE_OPS.has(fn))) {
        figurePages.add(n);
      }
    } catch {
      // A page whose operators will not parse still has readable text; losing
      // the figure flag is far better than losing the import.
    }

    const content = await page.getTextContent();

    const lines = new Map<number, string[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      // transform[5] is the y offset. Rounded, so fragments on one visual line
      // group together despite sub-pixel differences.
      const y = Math.round(item.transform[5]);
      const line = lines.get(y);
      if (line) line.push(item.str);
      else lines.set(y, [item.str]);
    }

    // PDF y-coordinates grow upwards, so top-to-bottom is descending.
    pages.push(
      [...lines.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, parts]) => parts.join("").trim())
        .filter(Boolean)
        .join("\n"),
    );
    page.cleanup();
  }

  const outline = await readOutline(doc);

  // Destroying the loading task releases the document with it; a long import
  // otherwise holds the whole PDF in memory until the request ends.
  await task.destroy();

  // Repair the extraction before anything else touches it. Everything
  // downstream — the split, the model, and above all the reader — works on this
  // text, and raw extraction is one line per line of the original with the
  // running header and page number embedded in it.
  return { pages: typesetBook(pages), outline, figurePages };
}

/**
 * The book's own bookmarks, flattened with their page numbers.
 *
 * A destination is a reference to a page object, not a page number, so each one
 * has to be resolved. Entries whose destination will not resolve are skipped
 * rather than guessed at — a bookmark pointing at the wrong chapter is worse
 * than one missing bookmark.
 */
async function readOutline(
  doc: Awaited<
    ReturnType<
      Awaited<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>["getDocument"]
    >["promise"]
  >,
): Promise<OutlineEntry[]> {
  type RawItem = { title: string; dest: unknown; items?: RawItem[] };

  const root = (await doc.getOutline()) as RawItem[] | null;
  if (!root || root.length === 0) return [];

  const entries: OutlineEntry[] = [];

  async function walk(items: RawItem[], level: number): Promise<void> {
    for (const item of items) {
      try {
        const dest =
          typeof item.dest === "string"
            ? await doc.getDestination(item.dest)
            : item.dest;
        const ref = Array.isArray(dest) ? dest[0] : null;
        if (ref) {
          const index = await doc.getPageIndex(
            ref as Parameters<typeof doc.getPageIndex>[0],
          );
          entries.push({ title: item.title, page: index + 1, level });
        }
      } catch {
        // Unresolvable destination — skip this entry, keep its children.
      }
      if (item.items?.length) await walk(item.items, level + 1);
    }
  }

  await walk(root, 0);
  return entries;
}

/** Sections, by whichever method can actually produce them. */
async function sectionBook(
  extracted: Extracted,
  title: string,
): Promise<{ sections: Section[]; how: string }> {
  const { pages, outline } = extracted;

  const fromOutline = sectionsFromOutline(outline, pages.length);
  // One untitled whole-book section means the outline told us nothing.
  if (fromOutline.length > 1) {
    return { sections: fromOutline, how: "the book's own contents" };
  }

  if (hasApiKey()) {
    try {
      const inferred = await inferSections(
        outlineProbe(pages),
        pages.length,
        title,
      );
      if (inferred.length > 1) return { sections: inferred, how: "read by AI" };
    } catch {
      // Fall through to the plain split rather than failing the whole import.
      // A book you can read unsectioned beats a book you cannot open.
    }
  }

  return {
    sections: [{ index: 0, title: null, firstPage: 1, lastPage: pages.length }],
    how: "length only",
  };
}

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

  const { storagePath, title, author, curriculumId } = parsed.data;

  // Storage policies enforce this too, but checking here means a crafted
  // request fails before it can create a row pointing at somebody else's file.
  if (!storagePath.startsWith(`${session.userId}/`)) {
    return NextResponse.json({ error: "Not your file." }, { status: 403 });
  }

  let bookId: string;
  try {
    bookId = await createBook(session.supabase, session.userId, {
      title,
      author,
      curriculumId,
      storagePath,
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
    throw error;
  }

  try {
    const { data, error } = await session.supabase.storage
      .from("books")
      .download(storagePath);
    if (error || !data) {
      throw new Error(error?.message ?? "Could not read the file.");
    }

    const extracted = await extract(new Uint8Array(await data.arrayBuffer()));
    const { sections, how } = await sectionBook(extracted, title);
    const portions = portionsForSections(sections, extracted.pages).map(
      (portion) => ({
        ...portion,
        // Which of this portion's own pages carry a picture.
        figurePages: Array.from(
          { length: portion.lastPage - portion.firstPage + 1 },
          (_, i) => portion.firstPage + i,
        ).filter((page) => extracted.figurePages.has(page)),
      }),
    );

    if (portions.length === 0) {
      throw new Error(
        "No text found — this looks like a scanned PDF, which would need OCR before it can be read here.",
      );
    }

    await savePassages(session.supabase, session.userId, bookId, portions);
    await markBook(session.supabase, session.userId, bookId, {
      status: "ready",
      pageCount: extracted.pages.length,
    });

    return NextResponse.json({
      bookId,
      pages: extracted.pages.length,
      sections: sections.length,
      passages: portions.length,
      sectionedBy: how,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read that PDF.";
    // Recorded on the book rather than only returned, so a failure is visible
    // on the shelf later instead of vanishing with the request.
    await markBook(session.supabase, session.userId, bookId, {
      status: "failed",
      error: message,
    }).catch(() => {});

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
