/**
 * The model client.
 *
 * One place to construct it, so "no key configured" is a single recognisable
 * error rather than a stack trace from inside the SDK on whichever route
 * happened to run first.
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * The model, everywhere.
 *
 * Deliberately not tuned down per call site. The work here is reading a book
 * closely and deciding what it actually tells you to do at a table — the entire
 * value is the judgement, and a cheaper model that misses the point produces a
 * study aid that quietly teaches the wrong thing.
 */
export const MODEL = "claude-opus-5";

/** No API key is configured, so nothing model-backed can run. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set.");
    this.name = "MissingApiKeyError";
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function anthropic(): Anthropic {
  if (!hasApiKey()) throw new MissingApiKeyError();
  return new Anthropic();
}
