import { SiteNav } from "@/components/site-nav";
import { loadViolations } from "@/lib/hands-store";
import { findLeaks } from "@/lib/leaks";
import { loadBooks, loadProgress } from "@/lib/reader/store";
import { optionalUser } from "@/lib/session";

/**
 * The shell around every real page.
 *
 * `optionalUser` rather than `requireUser`: this group holds the drill and the
 * library, both of which work perfectly well with no account. The nav simply
 * reports which state you are in.
 *
 * It also gathers what is waiting, so the nav can show it. Every one of those
 * queries is wrapped and discarded on failure — this runs on *every* page, and
 * a decoration that can take the whole app down is a bad trade at any price.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await optionalUser();

  let leaks = 0;
  let reading = false;

  if (session) {
    try {
      const violations = await loadViolations(session.supabase, session.userId);
      leaks = findLeaks(violations).filter((l) => l.drillable).length;
    } catch {
      // Table missing or unreachable. The nav simply shows no dot.
    }

    try {
      const [books, progress] = await Promise.all([
        loadBooks(session.supabase, session.userId),
        loadProgress(session.supabase, session.userId),
      ]);

      reading = books.some((book) => {
        const done = progress.get(book.id);
        return done && done.total > 0 && done.done < done.total;
      });
    } catch {
      // As above.
    }
  }

  return (
    <>
      <SiteNav
        email={session?.email ?? null}
        // `readingDone` is a per-book question the reading page answers
        // properly, and answering it here would mean loading every passage of
        // every book on every page load. The dot marks "a book is open", which
        // is the thing worth knowing from the nav.
        status={session ? { leaks, reading, readingDone: false } : undefined}
      />
      {children}
    </>
  );
}
