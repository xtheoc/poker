/**
 * The librarian.
 *
 * Not a reading plan — a plan is a fixed list decided in advance, and the whole
 * problem with a fixed list is that it cannot hear you say "that one was too
 * dense". This answers one question, repeatedly: *given what you have read and
 * what you made of it, what are the reasonable next books?*
 *
 * Three rules do the work.
 *
 * **It offers options, never an instruction.** The research produced two to four
 * defensible books at every stage, and which is right depends on things a
 * program cannot see — how much time you have this month, whether you learn
 * better from prose or from problems. So it presents the shortlist with the
 * reasoning and lets you choose. A single confident recommendation would be a
 * worse answer dressed up as a better one.
 *
 * **The verdict on the last book steers the next.** "Too basic" should skip
 * ahead; "too hard" should offer something gentler at the same stage rather
 * than marching on; "bounced" should offer a *different* book, not the same one
 * again with encouragement. Steering is the only reason the verdict is asked
 * for at all.
 *
 * **It says out loud when reading is not the answer.** If the hand history is
 * showing preflop leaks, another book is not the intervention — the drill is. A
 * librarian that only ever says "read this next" has an incentive problem.
 */

import { STAGES, type BookOption, type Stage, stageOf } from "./curriculum";

export type Verdict = "right" | "too-basic" | "too-hard" | "bounced";
export type ReadingStatus = "reading" | "finished" | "abandoned";

/** One book in your history. */
export interface ReadingEntry {
  bookId: string | null;
  title: string;
  author?: string | null;
  status: ReadingStatus;
  verdict?: Verdict | null;
  note?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

/** A book being offered, with the reason it is being offered now. */
export interface Suggestion {
  book: BookOption;
  stage: Stage;
  /** Why this one, in a sentence, given your history. */
  because: string;
}

/**
 * The mental-game stage, which is available from day one.
 *
 * Tendler belongs early rather than last, because it protects everything that
 * comes after it: a strategy you cannot execute on a bad night is not a strategy
 * you have. Keeping it out of the main sequence lets it be offered alongside
 * whatever stage you are actually on.
 */
const MENTAL_STAGE_ID = "mental";

/**
 * The stage you are working through.
 *
 * The first stage with nothing finished in it, ignoring the mental-game stage,
 * which is off the sequence by design.
 */
export function currentStage(history: readonly ReadingEntry[]): Stage {
  const finished = new Set(
    history.filter((e) => e.status === "finished").map((e) => e.bookId),
  );

  for (const stage of STAGES) {
    if (stage.id === MENTAL_STAGE_ID) continue;
    if (!stage.options.some((book) => finished.has(book.id))) return stage;
  }
  return STAGES[STAGES.length - 1];
}

/** The book currently open, if there is one. */
export function reading(
  history: readonly ReadingEntry[],
): ReadingEntry | undefined {
  return history.find((e) => e.status === "reading");
}

/**
 * What to read next.
 *
 * Returns a shortlist, ordered, with a reason attached to each. An empty list
 * means everything in the curriculum has been read — a real answer, with its
 * own message on the page.
 */
export function nextOptions(
  history: readonly ReadingEntry[],
  limit = 3,
): Suggestion[] {
  const finished = new Set(
    history.filter((e) => e.status === "finished").map((e) => e.bookId),
  );
  const touched = new Set(history.map((e) => e.bookId));
  const last = lastVerdict(history);
  const stage = currentStage(history);

  const suggestions: Suggestion[] = [];

  /** Add a book once, with its reason. */
  const offer = (book: BookOption, from: Stage, because: string) => {
    if (touched.has(book.id)) return;
    if (suggestions.some((s) => s.book.id === book.id)) return;
    suggestions.push({ book, stage: from, because });
  };

  // A book that was too basic means the stage is done, whatever the checklist
  // says. Marching back through its siblings would waste a month.
  if (last?.verdict === "too-basic") {
    const next = STAGES.find(
      (s) => s.number > stage.number && s.id !== MENTAL_STAGE_ID,
    );
    if (next) {
      for (const book of ordered(next)) {
        offer(
          book,
          next,
          `You found ${last.title} too basic, so this skips ahead to ${next.name.toLowerCase()}.`,
        );
      }
    }
  }

  // Too hard, or put down: offer the lighter end of the stage that book came
  // from — not of whatever stage finishing it advanced you into. Getting this
  // wrong turns "that was over my head" into a recommendation for something
  // harder still, which is the exact opposite of what was asked for.
  if (last?.verdict === "too-hard" || last?.verdict === "bounced") {
    const source = (last.bookId ? stageOf(last.bookId) : undefined) ?? stage;
    for (const book of [...source.options].sort((a, b) => hours(a) - hours(b))) {
      offer(
        book,
        source,
        last.verdict === "too-hard"
          ? `Lighter than ${last.title}, and covers the same ground.`
          : `A different way into the same material as ${last.title}.`,
      );
    }
  }

  // The normal path: this stage's own options, recommended pick first.
  for (const book of ordered(stage)) {
    offer(
      book,
      stage,
      book.recommended
        ? `The default pick for ${stage.name.toLowerCase()}: ${stage.goal.toLowerCase()}`
        : `Also at ${stage.name.toLowerCase()}, if it suits you better.`,
    );
  }

  // The mental game sits outside the sequence and stays on offer until read,
  // because it protects every hour spent on the rest.
  const mental = STAGES.find((s) => s.id === MENTAL_STAGE_ID);
  if (mental && !mental.options.some((b) => finished.has(b.id))) {
    for (const book of ordered(mental)) {
      offer(
        book,
        mental,
        "Out of sequence on purpose — a strategy you cannot execute on a bad night is not a strategy you have.",
      );
    }
  }

  return suggestions.slice(0, limit);
}

/** Recommended pick first, then by how long it takes. */
function ordered(stage: Stage): BookOption[] {
  return [...stage.options].sort((a, b) => {
    if (Boolean(a.recommended) !== Boolean(b.recommended)) {
      return a.recommended ? -1 : 1;
    }
    return hours(a) - hours(b);
  });
}

function hours(book: BookOption): number {
  return (book.activeHours[0] + book.activeHours[1]) / 2;
}

/** The most recently closed book that carried a verdict. */
function lastVerdict(history: readonly ReadingEntry[]): ReadingEntry | undefined {
  return history
    .filter((e) => e.verdict && e.status !== "reading")
    .sort(
      (a, b) =>
        (b.finishedAt ?? b.startedAt).getTime() -
        (a.finishedAt ?? a.startedAt).getTime(),
    )[0];
}

/**
 * Whether reading is the right use of the next hour at all.
 *
 * The one thing a reading list will never tell you unprompted. Preflop leaks
 * get fixed by drilling them, not by reading a chapter about them, and the
 * research is blunt that reading which does not convert into practice is the
 * failure mode this whole curriculum is designed against.
 */
export function readingIsTheAnswer(drillableLeaks: number): {
  ok: boolean;
  note: string;
} {
  if (drillableLeaks >= 3) {
    return {
      ok: false,
      note: `Your hands currently show ${drillableLeaks} preflop leaks. None of them will be fixed by a book — they are fixed by drilling them until the right answer is automatic. Read by all means, but the drill is where this week's edge is.`,
    };
  }
  if (drillableLeaks > 0) {
    return {
      ok: true,
      note: `${drillableLeaks} preflop ${
        drillableLeaks === 1 ? "leak" : "leaks"
      } still showing in your hands. Keep the drill running alongside whatever you read.`,
    };
  }
  return {
    ok: true,
    note: "Nothing in your hands is currently costing you preflop, so reading is a good use of the time.",
  };
}
