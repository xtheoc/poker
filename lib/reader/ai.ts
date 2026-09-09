/**
 * The three things the model does to a book.
 *
 * **Sections it**, when the PDF carries no outline of its own. **Enriches** a
 * portion — the claims it actually makes, an example where it is abstract, and
 * what to do about it at a table. **Distils** a finished portion into rules for
 * the playbook.
 *
 * The prompts are the product here, so they are written out in full rather than
 * assembled from fragments. Two rules run through all three:
 *
 * **Extract, never summarise.** A summary of a chapter is just a shorter thing
 * to forget. What is wanted is the specific propositions the author commits to,
 * in a form you could disagree with.
 *
 * **Never invent poker.** The model has plenty of opinions about poker and none
 * of them are the book's. Anything it says must be traceable to the passage,
 * because a study aid whose claims are half book and half model is worse than
 * none — you cannot tell which half you are learning.
 */

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MODEL, anthropic } from "../ai";
import type { Section } from "./sections";

const SectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().describe("The section's own title, as printed"),
        startPage: z.number().int().describe("One-based page it begins on"),
      }),
    )
    .describe("In reading order, starting from the first real section"),
});

const EnrichmentSchema = z.object({
  claims: z
    .array(z.string())
    .describe("The specific propositions this passage argues for"),
  example: z
    .string()
    .nullable()
    .describe(
      "A concrete worked hand, or null if the passage is already concrete",
    ),
  atTable: z.array(z.string()).describe("What to actually do, in the imperative"),
});

const ReviewSchema = z.object({
  complete: z
    .boolean()
    .describe("True when the summary covers everything that matters"),
  missing: z
    .array(z.string())
    .describe("Specific points the summary left out. Empty when complete."),
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("How much of the passage the summary covered"),
  rules: z
    .array(z.string())
    .describe("Imperative rules for the book's summary. Only when complete."),
});

export type Enrichment = z.infer<typeof EnrichmentSchema>;
export type Review = z.infer<typeof ReviewSchema>;

/**
 * Infer sections for a book whose PDF has no outline.
 *
 * Takes the compact page map rather than the text, and does the whole book in
 * one call: sectioning is a judgement about the *shape* of the thing, and doing
 * it chapter by chapter would produce boundaries that contradict each other.
 */
export async function inferSections(
  probe: string,
  pageCount: number,
  title: string,
): Promise<Section[]> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      "You are given a page-by-page map of a poker book: each line is a page number and the first line or two of text on that page.",
      "Identify where the book's real sections begin — chapters, or major parts within a chapter.",
      "",
      "Rules:",
      "- A section is a unit of argument, not a heading. Aim for sections of roughly 5 to 25 pages.",
      "- Use the book's own titles where the map shows them. Do not invent titles that are not there.",
      "- Skip front matter, contents pages and indexes: start at the first real content.",
      "- startPage must be a page number that appears in the map.",
      "- Return them in reading order.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: `Book: ${title}\nPages: ${pageCount}\n\n${probe}`,
      },
    ],
    output_config: { format: zodOutputFormat(SectionsSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) return [];

  const starts = parsed.sections
    .filter((s) => s.startPage >= 1 && s.startPage <= pageCount)
    .sort((a, b) => a.startPage - b.startPage);

  const sections: Section[] = [];
  for (let i = 0; i < starts.length; i++) {
    // Same rule as the outline path: two starts on one page are one section.
    if (i > 0 && starts[i].startPage === starts[i - 1].startPage) continue;
    const next = starts.find((s) => s.startPage > starts[i].startPage);
    sections.push({
      index: sections.length,
      title: starts[i].title.trim() || null,
      firstPage: starts[i].startPage,
      lastPage: next ? next.startPage - 1 : pageCount,
    });
  }

  return sections;
}

/**
 * Read one portion closely and say what it is actually claiming.
 *
 * The example is nullable on purpose, and the prompt is explicit about when to
 * leave it null. A book that already works through a hand does not need a
 * second invented one — that is padding, and padding is what makes people skim.
 */
export async function enrich(
  text: string,
  context: { bookTitle: string; sectionTitle: string | null },
): Promise<Enrichment | null> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: [
      "You help a beginner playing 6-max no-limit hold'em cash games at NL2 get the most out of a poker book they are reading.",
      "They can see the real pages. You are adding notes beside the text, not replacing it.",
      "",
      "Produce three things:",
      "",
      "claims — 2 to 4 specific propositions this passage argues for, one sentence each.",
      "  Write what the author commits to, not what the passage is 'about'.",
      "  Bad: 'This section discusses continuation betting.'",
      "  Good: 'Continuation bet more often on dry boards than wet ones, because your opponent has fewer hands worth continuing with.'",
      "",
      "example — one concrete hand illustrating the passage's main point: positions, stack depth in big blinds, the action, and what to do.",
      "  Return null if the passage already works through its own examples. Do not pad.",
      "",
      "atTable — 1 to 3 imperatives the reader could follow tonight, specific enough to act on.",
      "",
      "Hard rules:",
      "- Every claim must be traceable to this passage. If the passage does not say it, do not write it.",
      "- No definitions of standard terms. They know what a c-bet is.",
      "- If the passage is throat-clearing with no real content, return empty arrays and a null example. That is a valid answer.",
      "- The passage is raw PDF text extraction, so expect broken line breaks and stray page numbers. Read through that.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Book: ${context.bookTitle}`,
          context.sectionTitle ? `Section: ${context.sectionTitle}` : "",
          "",
          "Passage:",
          text,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    output_config: { format: zodOutputFormat(EnrichmentSchema) },
  });

  return response.parsed_output ?? null;
}

/**
 * Mark a written summary, name what is missing, and — once nothing is — turn
 * the section into rules for the book's summary.
 *
 * One call rather than two, because both jobs need the same two inputs and the
 * same reading of them, and because splitting them would let the marker judge a
 * summary complete while the rule-writer found nothing to write.
 *
 * `complete` is the loop's exit condition, so the prompt has to hold a line in
 * both directions. Too strict and the reader is trapped rewriting forever over
 * a clause that did not matter, which is how someone abandons a book. Too loose
 * and the whole mechanism is theatre. The instruction is therefore about
 * *substance* — the argument and its conditions — explicitly not about wording,
 * completeness of detail, or matching the author's phrasing.
 */
export async function reviewSummary(
  text: string,
  summary: string,
  context: { bookTitle: string; sectionTitle: string | null; attempt: number },
): Promise<Review | null> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: [
      "A reader has read a passage of a poker book and written, from memory, what it said.",
      "They will rewrite until nothing important is missing, so your judgement decides when they move on.",
      "",
      "Produce four things:",
      "",
      "complete — true when the summary captures the passage's substance.",
      "  Substance means: the main argument, the reasons given for it, and the conditions under which it applies.",
      "  It does NOT mean every example, every number, or the author's wording. They are writing in their own words; that is the point.",
      "  Be fair in both directions. Passing a summary that misses the actual argument makes this whole exercise theatre.",
      "  Refusing one over a detail that does not matter traps the reader, and a trapped reader abandons the book.",
      "",
      "missing — the specific points left out, one short line each, at most three.",
      "  Name the point, do not restate the passage. 'The pot-odds reasoning for defending' — not a paragraph.",
      "  Empty when complete.",
      "",
      "score — 0 to 100, how much of the substance the summary captured.",
      "",
      "rules — only when complete: 1 to 3 imperatives capturing what this passage tells the reader to DO at the table.",
      "  These accumulate into a summary of the whole book that they will consult mid-session, so each must stand alone",
      "  months later without the passage beside it, and must carry the conditions under which it applies.",
      "  Bad: 'Be more aggressive.'",
      "  Good: 'On a dry flop in position after raising preflop, bet about a third of the pot with your whole range.'",
      "  If the passage is purely conceptual with nothing to do at a table, return an empty array.",
      "  Empty when not complete.",
      "",
      "Hard rules:",
      "- Rules and missing points come from the passage, never from your own poker knowledge.",
      "- Do not manufacture a criticism to seem rigorous, and do not flatter. Both cost the reader the thing they came for.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Book: ${context.bookTitle}`,
          context.sectionTitle ? `Section: ${context.sectionTitle}` : "",
          `This is attempt ${context.attempt}.`,
          "",
          "Passage:",
          text,
          "",
          "Their summary:",
          summary,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    output_config: { format: zodOutputFormat(ReviewSchema) },
  });

  return response.parsed_output ?? null;
}
