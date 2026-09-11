import { SiteNav } from "@/components/site-nav";
import { optionalUser } from "@/lib/session";

/**
 * The shell around every real page.
 *
 * `optionalUser` rather than `requireUser`: this group holds the drill and the
 * library, both of which work perfectly well with no account. The nav simply
 * reports which state you are in.
 *
 * Strategy pages own their learning state. The global shell only provides a
 * route back to the strategy catalogue and account configuration.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await optionalUser();

  return (
    <>
      <SiteNav email={session?.email ?? null} />
      {children}
    </>
  );
}
