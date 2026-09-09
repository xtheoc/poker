/**
 * Supabase settings, read once and with a message that says what to do.
 *
 * Two accessors on purpose, because this app is useful before it has an
 * account. The preflop trainer, the reading list and the hand analyser all run
 * entirely in the browser, so a missing Supabase configuration must degrade to
 * "you are signed out" rather than crashing the page. Only the parts that
 * genuinely need to remember something — drill history, leak history, reading
 * progress — insist on it.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/**
 * Prefixes that mark a key as privileged.
 *
 * `sb_secret_` is the current name for what used to be the service_role key.
 * Both bypass row-level security completely.
 */
const SECRET_KEY_MARKERS = ["sb_secret_", "service_role"];

/**
 * The settings, or null when Supabase has not been configured yet.
 *
 * Refuses outright to hand back a privileged key. The two keys sit next to each
 * other in the dashboard and are trivially easy to confuse, and the failure is
 * silent and severe: anything in a `NEXT_PUBLIC_` variable is compiled into the
 * JavaScript bundle and served to every visitor, so a secret key pasted here
 * would be published to the world while the app carried on working perfectly.
 * Better to break loudly at startup.
 */
export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (SECRET_KEY_MARKERS.some((marker) => anonKey.includes(marker))) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY holds a secret key. That key bypasses " +
        "row-level security and NEXT_PUBLIC_ values are served to every " +
        "visitor. Rotate it in the Supabase dashboard, then use the " +
        "publishable key (sb_publishable_…) instead.",
    );
  }

  // A URL with a path already on it produces 404s on every request, because the
  // client library appends its own.
  const origin = url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

  return { url: origin, anonKey };
}

/** True when the app can talk to a database at all. */
export function isSupabaseConfigured(): boolean {
  return supabaseEnv() !== null;
}

/**
 * The settings, or a failure that explains the fix.
 *
 * Used by the paths that cannot work without a database, so the error names the
 * file to edit rather than surfacing as an undefined URL three layers into the
 * client library.
 */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = supabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Fill in NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local — both are in the " +
        "Supabase dashboard under Project Settings, API — then restart the " +
        "dev server.",
    );
  }
  return env;
}
