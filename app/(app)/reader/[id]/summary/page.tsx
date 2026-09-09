import Link from "next/link";
import { notFound } from "next/navigation";
import { type BookNote, loadBook, loadNotes } from "@/lib/reader/store";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Summary" };

/**
 * Everything the book has taught you, in the imperative.
 *
 * Its own page because of when it gets opened: mid-session, on a second screen,
 * to settle one decision. That rules out most of what a "book summary" usually
 * is — no prose, no chapter recaps, no explanation of the reasoning. The
 * reasoning is what the reading was for, and by the time this is open it is
 * either in your head or it is not. What is left is the instruction.
 *
 * Rules only reach this page once their section's summary was complete, so it
 * is a record of what you actually took in rather than what you read past.
 *
 * Grouped by section and tagged with pages, so a rule you distrust can be
 * checked against the book instead of taken on the model's word.
 */
export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();

  const [book, notes] = await Promise.all([
    loadBook(session.supabase, session.userId, id),
    loadNotes(session.supabase, session.userId, id),
  ]);
  if (!book) notFound();

  const sections = groupBySection(notes);

  return (
    <div className="dark min-h-screen bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-baseline justify-between">
          <Link
            href={`/reader/${id}`}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Reading
          </Link>
          <span className="text-xs text-zinc-500">{book.title}</span>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Nothing here yet. Finish a section and its rules land here.
          </p>
        ) : (
          <div className="space-y-8">
            {sections.map(([title, rules]) => (
              <section key={title ?? "untitled"}>
                {title && (
                  <h2 className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    {title}
                  </h2>
                )}
                <ul className="space-y-3">
                  {rules.map((note) => (
                    <li key={note.id}>
                      <p className="text-[0.9375rem] leading-relaxed text-zinc-100">
                        {note.rule}
                      </p>
                      {note.sourcePages && (
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {note.sourcePages}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Group in reading order, keeping sections in the order they were finished.
 *
 * A Map preserves insertion order and the notes arrive ordered by passage
 * index, so the result reads in the order the book does.
 */
function groupBySection(
  notes: readonly BookNote[],
): Array<[string | null, BookNote[]]> {
  const groups = new Map<string | null, BookNote[]>();

  for (const note of notes) {
    const existing = groups.get(note.sectionTitle);
    if (existing) existing.push(note);
    else groups.set(note.sectionTitle, [note]);
  }

  return [...groups];
}
