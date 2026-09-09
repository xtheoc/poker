/**
 * The tables are missing, and here is how to create them.
 *
 * This exists because of a real failure: the hand tables shipped before they
 * had been created, and the page answered with a runtime stack trace. A stack
 * trace is the right thing to show a developer who has a bug and the wrong
 * thing to show anybody who simply has not run a migration yet — the fix is
 * known, specific and takes ten seconds, so the screen should just say it.
 *
 * It is deliberately not a silent empty state. "No sessions yet" would be a lie
 * that looks like success, and what follows is a confused hour spent wondering
 * why importing does nothing.
 */
export function MigrationNotice({
  file,
  what = "This page needs a table or column your database does not have yet.",
}: {
  file: string;
  /** What is missing, in a sentence. The default fits any page. */
  what?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="font-medium text-amber-900 dark:text-amber-200">
        One migration still to run.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
        {what} Open the SQL editor in your Supabase project, paste the contents
        of the file below, and run it. Nothing here works until you do.
      </p>
      <code className="mt-3 block overflow-x-auto rounded-lg bg-amber-100 px-3 py-2 font-mono text-[11px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
        {file}
      </code>
    </div>
  );
}
