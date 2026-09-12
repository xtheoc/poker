#!/usr/bin/env node

import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const port = 4318;
const redirectTo = `http://127.0.0.1:${port}/callback`;
const project = resolve(import.meta.dirname, "..");
const watcher = join(import.meta.dirname, "hand-history-watcher.mjs");
const env = await publicEnvironment(join(project, ".env.local"));
const appUrl = process.env.POKER_STUDY_URL ?? "https://poker-kappa-eight.vercel.app";
const defaultFolder = join(process.env.LOCALAPPDATA ?? homedir(), "PokerStars", "HandHistory");

if (!env.url || !env.anonKey) stop("Could not read the public Supabase settings from .env.local.");
if (!existsSync(watcher)) stop("Could not find hand-history-watcher.mjs.");

const input = createInterface({ input: process.stdin, output: process.stdout });
console.log("Poker Study automatic hand importer");
console.log(`Before continuing, add this once in Supabase Authentication -> URL Configuration -> Redirect URLs:\n${redirectTo}\n`);

const folderInput = await input.question(`Hand-history folder (Enter for ${defaultFolder}): `);
const folder = resolve(folderInput.trim() || defaultFolder);
if (!existsSync(folder)) stop(`That folder does not exist: ${folder}`);
const email = (await input.question("Poker Study email: ")).trim();
input.close();
if (!email.includes("@")) stop("Enter the email address you use to sign in to Poker Study.");

const supabase = createClient(env.url, env.anonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: false },
});

let settle;
const completed = new Promise((resolveSession, rejectSession) => {
  settle = { resolve: resolveSession, reject: rejectSession };
});
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", redirectTo);
  if (url.pathname !== "/callback") {
    response.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    response.writeHead(400, { "Content-Type": "text/plain" }).end("Missing sign-in code.");
    return;
  }
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session?.refresh_token) {
    response.writeHead(400, { "Content-Type": "text/plain" }).end("Could not finish sign-in. Return to setup and try again.");
    settle.reject(error ?? new Error("No session returned."));
    return;
  }
  response.writeHead(200, { "Content-Type": "text/plain" }).end("Poker Study is connected. You can close this page.");
  settle.resolve(data.session);
});

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(port, "127.0.0.1", resolveListen);
});

const { error: signInError } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: redirectTo },
});
if (signInError) {
  // Let Windows release the local callback socket before returning an error.
  // Calling process.exit() while libuv is closing this handle can itself emit
  // a noisy assertion, hiding the actionable Supabase response.
  await new Promise((resolveClose) => server.close(resolveClose));
  throw new Error(`Could not send sign-in email: ${signInError.message}`);
}

console.log("Sign-in email sent. Open its link in this browser; setup will finish automatically.");
let session;
try {
  session = await Promise.race([
    completed,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Sign-in timed out.")), 10 * 60_000)),
  ]);
} finally {
  server.close();
}

const configFolder = join(process.env.APPDATA ?? homedir(), "Poker Study");
await mkdir(configFolder, { recursive: true });
const configPath = join(configFolder, "hand-history-watcher.json");
await writeFile(configPath, `${JSON.stringify({
  folder,
  endpoint: new URL("/api/hands/import", appUrl).toString(),
  supabaseUrl: env.url,
  anonKey: env.anonKey,
  refreshToken: session.refresh_token,
}, null, 2)}\n`, "utf8");

const startup = join(
  process.env.APPDATA ?? homedir(),
  "Microsoft", "Windows", "Start Menu", "Programs", "Startup",
);
await mkdir(startup, { recursive: true });
const launcher = join(startup, "Poker Study Hand Import.vbs");
await writeFile(
  launcher,
  [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run ${vbsString(`"${process.execPath}" "${watcher}" --config "${configPath}"`)}, 0, False`,
  ].join("\r\n"),
  "utf8",
);
await unlink(join(startup, "Poker Study Hand Import.cmd")).catch(() => {});

spawn(process.execPath, [watcher, "--config", configPath], {
  detached: true,
  stdio: "ignore",
}).unref();

console.log("Ready. Completed hand histories will import after PokerStars closes and every time you sign in to Windows.");

async function publicEnvironment(path) {
  try {
    const text = await readFile(path, "utf8");
    const read = (name) => text.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim().replace(/^['\"]|['\"]$/g, "");
    return {
      url: read("NEXT_PUBLIC_SUPABASE_URL"),
      anonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    };
  } catch {
    return {};
  }
}

function stop(message) {
  console.error(message);
  process.exit(1);
}

function vbsString(value) {
  return `"${value.replace(/"/g, '""')}"`;
}
