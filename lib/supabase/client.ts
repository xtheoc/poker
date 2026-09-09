import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/** A Supabase client for the browser. Only reached from signed-in surfaces. */
export function createClient() {
  const env = requireSupabaseEnv();
  return createBrowserClient(env.url, env.anonKey);
}
