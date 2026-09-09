import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "./env";

/**
 * Keep the session fresh on every request.
 *
 * Deliberately does **not** gate the app behind a login. Most of this platform
 * is useful with no account at all — the preflop trainer, the reading list and
 * the hand analyser all run in the browser — and redirecting a signed-out
 * visitor to a login screen would hide the parts that work in order to protect
 * the parts that are not there yet. Pages that genuinely need an account ask
 * for one themselves.
 *
 * Refreshing has to happen here regardless: Server Components cannot write
 * cookies, so this is the only place an expiring session can be renewed.
 */
export async function updateSession(request: NextRequest) {
  const env = supabaseEnv();
  // Not configured yet, so there is no session to refresh and nothing to do.
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates against the auth server; getSession() would simply
  // trust whatever the cookie claims.
  await supabase.auth.getUser();

  return response;
}
