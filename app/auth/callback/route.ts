import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the emailed sign-in link lands.
 *
 * Swaps the one-time code for a session and sets the cookies, then sends the
 * user on. Any failure goes back to the sign-in page with a reason rather than
 * dumping a raw error — a broken link is almost always an expired one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=expired", url.origin));
  }

  // Only ever redirect within this app: an open redirect here would let a
  // crafted link bounce a freshly authenticated user somewhere else entirely.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(destination, url.origin));
}
