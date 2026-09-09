import { describe, expect, it } from "vitest";
import {
  type ReadingEntry,
  currentStage,
  nextOptions,
  readingIsTheAnswer,
} from "./reading";

function entry(over: Partial<ReadingEntry> & { bookId: string }): ReadingEntry {
  return {
    title: over.bookId,
    status: "finished",
    startedAt: new Date("2026-09-01T10:00:00Z"),
    finishedAt: new Date("2026-09-20T21:15:00Z"),
    ...over,
  };
}

describe("where you are in the curriculum", () => {
  it("starts at foundations with nothing read", () => {
    expect(currentStage([]).id).toBe("foundations");
  });

  it("moves on once a book from the stage is finished", () => {
    expect(currentStage([entry({ bookId: "crushing-microstakes" })]).id).toBe(
      "fundamentals",
    );
  });

  it("does not count a book you are still reading", () => {
    const stage = currentStage([
      entry({ bookId: "crushing-microstakes", status: "reading" }),
    ]);
    expect(stage.id).toBe("foundations");
  });

  it("does not treat the mental game as progress through the sequence", () => {
    // Tendler is off the main path on purpose. Reading it must not skip you
    // past fundamentals you have not read.
    expect(currentStage([entry({ bookId: "mental-game-poker" })]).id).toBe(
      "foundations",
    );
  });
});

describe("what to read next", () => {
  it("leads with the recommended pick for the current stage", () => {
    const options = nextOptions([]);
    expect(options[0].book.id).toBe("crushing-microstakes");
    expect(options[0].stage.id).toBe("foundations");
  });

  it("never offers a book you have already picked up", () => {
    const options = nextOptions([
      entry({ bookId: "crushing-microstakes", status: "reading" }),
    ]);
    expect(options.map((o) => o.book.id)).not.toContain("crushing-microstakes");
  });

  it("keeps the mental game on the table until it is read", () => {
    const options = nextOptions([], 4);
    expect(options.map((o) => o.stage.id)).toContain("mental");
  });

  it("skips ahead when the last book was too basic", () => {
    // Marching back through the siblings of a book you already found easy
    // would cost a month for nothing.
    const options = nextOptions([
      entry({ bookId: "crushing-microstakes", verdict: "too-basic" }),
    ]);
    expect(options[0].stage.number).toBeGreaterThan(0);
    expect(options[0].because).toMatch(/too basic/i);
  });

  it("offers something lighter when the last book was too hard", () => {
    const options = nextOptions([
      entry({ bookId: "the-course", verdict: "too-hard" }),
    ]);
    expect(options[0].stage.id).toBe("foundations");
    expect(options[0].because).toMatch(/lighter/i);
  });

  it("offers a different route in when a book was put down", () => {
    const options = nextOptions([
      entry({
        bookId: "crushing-microstakes",
        status: "abandoned",
        verdict: "bounced",
      }),
    ]);
    expect(options[0].because).toMatch(/different way/i);
    expect(options.map((o) => o.book.id)).not.toContain("crushing-microstakes");
  });

  it("follows the most recent verdict, not the first", () => {
    const options = nextOptions([
      entry({
        bookId: "crushing-microstakes",
        verdict: "too-basic",
        finishedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      entry({
        bookId: "grinders-manual",
        verdict: "too-hard",
        finishedAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ]);
    expect(options[0].because).toMatch(/lighter/i);
  });
});

describe("saying when reading is not the answer", () => {
  it("pushes you to the drill when leaks are piling up", () => {
    const verdict = readingIsTheAnswer(4);
    expect(verdict.ok).toBe(false);
    expect(verdict.note).toMatch(/drill/i);
  });

  it("is happy for you to read when nothing is leaking", () => {
    expect(readingIsTheAnswer(0).ok).toBe(true);
  });

  it("still mentions a single leak without blocking the reading", () => {
    const verdict = readingIsTheAnswer(1);
    expect(verdict.ok).toBe(true);
    expect(verdict.note).toMatch(/1 preflop leak/);
  });
});
