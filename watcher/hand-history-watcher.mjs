#!/usr/bin/env node

import { execFile } from "node:child_process";
import { watch } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_CHARS = 6_000_000;
const RESCAN_MS = 15_000;
const settledFiles = new Map();
let running = false;
let queued = false;

const configPath = valueAfter("--config");
if (!configPath) stop("Missing --config path.");

const config = await readConfig(configPath);
if (!config.folder || !config.endpoint || !config.supabaseUrl || !config.anonKey || !config.refreshToken) {
  stop("The watcher configuration is incomplete. Run setup-watcher.cmd again.");
}

const folder = resolve(config.folder);
let accessToken = null;
let accessExpiresAt = 0;
console.log(`Poker Study hand watcher\nFolder: ${folder}\nWaiting for PokerStars to close before importing.`);

async function readConfig(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    stop(`Could not read configuration: ${path}`);
  }
}

function valueAfter(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function stop(message) {
  console.error(message);
  process.exit(1);
}

async function pokerStarsIsOpen() {
  if (process.platform !== "win32") return false;
  try {
    const { stdout } = await execFileAsync(
      "tasklist",
      ["/FI", "IMAGENAME eq PokerStars.exe", "/NH"],
      { windowsHide: true },
    );
    return /PokerStars\.exe/i.test(stdout);
  } catch {
    // If Windows cannot answer, leave files alone. A missed import retries on
    // the next scan; reading while the poker client is live is not acceptable.
    return true;
  }
}

async function filesBelow(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return filesBelow(child);
    return entry.isFile() && extname(entry.name).toLowerCase() === ".txt" ? [child] : [];
  }));
  return nested.flat();
}

function historyChunks(text) {
  if (text.length <= MAX_CHARS) return [text];
  const hands = text.split(/(?=^PokerStars\s+(?:Zoom\s+|Home\s+)?(?:Hand|Game)\s+#)/m);
  const chunks = [];
  let chunk = "";
  for (const hand of hands) {
    if (chunk && chunk.length + hand.length > MAX_CHARS) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += hand;
  }
  if (chunk.trim()) chunks.push(chunk);
  return chunks;
}

async function upload(file) {
  const info = await stat(file);
  const signature = `${info.size}:${info.mtimeMs}`;
  if (settledFiles.get(file) === signature) return;

  const text = await readFile(file, "utf8");
  if (!/^PokerStars\s+(?:Zoom\s+|Home\s+)?(?:Hand|Game)\s+#/m.test(text)) return;

  for (const chunk of historyChunks(text)) {
    let response = await send(chunk);
    if (response.status === 401) {
      await refreshAccessToken(true);
      response = await send(chunk);
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? `Server returned ${response.status}.`);
  }

  settledFiles.set(file, signature);
  console.log(`${new Date().toLocaleTimeString()} imported ${basename(file)}`);
}

async function refreshAccessToken(force = false) {
  if (!force && accessToken && Date.now() < accessExpiresAt) return accessToken;
  const response = await fetch(`${config.supabaseUrl.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: config.refreshToken }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.access_token) {
    throw new Error(result?.error_description ?? "The connection code has expired. Connect the folder again from Poker Study.");
  }
  accessToken = result.access_token;
  accessExpiresAt = Date.now() + Math.max((result.expires_in ?? 300) - 30, 30) * 1_000;
  if (result.refresh_token && result.refresh_token !== config.refreshToken) {
    config.refreshToken = result.refresh_token;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
  return accessToken;
}

async function send(text) {
  const token = await refreshAccessToken();
  return fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });
}

async function scan() {
  if (running) return;
  running = true;
  try {
    if (await pokerStarsIsOpen()) return;
    for (const file of await filesBelow(folder)) {
      try {
        await upload(file);
      } catch (error) {
        console.error(`${new Date().toLocaleTimeString()} ${basename(file)}: ${error instanceof Error ? error.message : "import failed"}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not scan the hand-history folder.");
  } finally {
    running = false;
  }
}

function queueScan() {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    void scan();
  }, 1_500);
}

try {
  watch(folder, { recursive: true }, (_event, changed) => {
    if (!changed || extname(changed).toLowerCase() === ".txt") queueScan();
  });
} catch {
  console.log("Folder events are unavailable; checking every 15 seconds instead.");
}

await scan();
setInterval(() => void scan(), RESCAN_MS);
