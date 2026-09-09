import { describe, expect, it } from "vitest";
import {
  type Card,
  type DrillResult,
  ESTABLISHED_STABILITY_DAYS,
  Rating,
  State,
  newCard,
  queuePriority,
  review,
  schedulerParams,
  selectQueue,
  sessionRating,
} from "./srs";

const NOW = new Date("2026-09-02T12:00:00Z");

function results(
  spec: Array<Partial<DrillResult>>,
  base: DrillResult = { grade: "best", score: 1, durationMs: 1_500 },
): DrillResult[] {
  return spec.map((s) => ({ ...base, ...s }));
}

describe("scheduler parameters", () => {
  it("enables fuzz, against the library default", () => {
    // Without fuzz every card learned together stays due together forever and
    // the queue becomes a series of spikes, which is how the habit dies.
    expect(schedulerParams().enable_fuzz).toBe(true);
  });

  it("uses FSRS-6's full weight vector rather than anything hardcoded here", () => {
    expect(schedulerParams().w).toHaveLength(21);
  });

  it("accepts a desired-retention override", () => {
    expect(schedulerParams({ request_retention: 0.85 }).request_retention).toBe(0.85);
  });
});

describe("reviewing a card", () => {
  it("schedules a new card forward on a good review", () => {
    const card = newCard(NOW);
    const { card: next } = review(card, Rating.Good, NOW);
    expect(next.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.reps).toBe(1);
  });

  it("lengthens the interval as a card is repeatedly known", () => {
    // The core promise of spaced repetition: things you keep getting right
    // come back less often. If this fails, the whole scheduler is decoration.
    let card = newCard(NOW);
    let at = NOW;
    let previousInterval = 0;

    for (let i = 0; i < 6; i++) {
      const { card: next } = review(card, Rating.Good, at);
      const interval = next.due.getTime() - at.getTime();
      if (i > 1) expect(interval).toBeGreaterThan(previousInterval);
      previousInterval = interval;
      card = next;
      at = next.due;
    }

    // After six clean reviews it should be weeks out, not hours.
    expect(card.stability).toBeGreaterThan(7);
  });

  it("collapses the interval and records a lapse on Again", () => {
    let card = newCard(NOW);
    let at = NOW;
    for (let i = 0; i < 5; i++) {
      const { card: next } = review(card, Rating.Good, at);
      card = next;
      at = next.due;
    }
    const establishedStability = card.stability;
    // Six clean reviews should have pushed this well past a week.
    expect(establishedStability).toBeGreaterThan(7);

    const { card: lapsed } = review(card, Rating.Again, at);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.stability).toBeLessThan(establishedStability);
    // And it comes back within the day rather than staying weeks out — a
    // forgotten card is worthless sitting in the future.
    const lapsedIntervalDays =
      (lapsed.due.getTime() - at.getTime()) / 86_400_000;
    expect(lapsedIntervalDays).toBeLessThan(1);
  });

  it("emits a log entry describing the review that happened", () => {
    // The log is append-only and is the training set for per-user parameter
    // fitting, so it carries the pre-review state, not the post-review one.
    const card = newCard(NOW);
    const { log } = review(card, Rating.Good, NOW);
    expect(log.rating).toBe(Rating.Good);
    expect(log.state).toBe(card.state);
    expect(log.review).toEqual(NOW);
  });
});

describe("turning a drill session into a rating", () => {
  it("rates a clean, quick session Good", () => {
    expect(sessionRating(results([{}, {}, {}]))).toBe(Rating.Good);
  });

  it("treats a single blunder as a lapse however good the rest was", () => {
    // Four right and one hand stacked off with a holding that should never be
    // played is not an 80% session — the blunder is the part that costs money.
    const session = results([{}, {}, {}, {}, { grade: "blunder", score: -1 }]);
    expect(sessionRating(session)).toBe(Rating.Again);
  });

  it("caps a session containing an out-of-strategy action at Hard", () => {
    const session = results([{}, {}, { grade: "wrong", score: -0.6 }]);
    expect(sessionRating(session)).toBe(Rating.Hard);
  });

  it("caps a slow session at Hard even when every answer was right", () => {
    // Derived is not remembered. FSRS has no latency input, so this is the
    // only route by which "I had to think about it" reaches the scheduler.
    const session = results([{}, {}, {}], {
      grade: "best",
      score: 1,
      durationMs: 12_000,
    });
    expect(sessionRating(session)).toBe(Rating.Hard);
  });

  it("does not award Easy on a card that is not yet established", () => {
    // Otherwise one lucky first review pushes a card weeks out before it has
    // been demonstrated even once.
    const fresh = newCard(NOW);
    const session = results([{}, {}], { grade: "best", score: 1, durationMs: 900 });
    expect(sessionRating(session, fresh)).toBe(Rating.Good);
  });

  it("awards Easy for a fast clean session on an established card", () => {
    const established: Card = {
      ...newCard(NOW),
      state: State.Review,
      stability: ESTABLISHED_STABILITY_DAYS + 5,
    };
    const session = results([{}, {}], { grade: "best", score: 1, durationMs: 900 });
    expect(sessionRating(session, established)).toBe(Rating.Easy);
  });

  it("rates an empty session Again rather than crediting it", () => {
    // A card opened and abandoned is not a card reviewed.
    expect(sessionRating([])).toBe(Rating.Again);
  });

  it("tolerates one inaccuracy in an otherwise clean session", () => {
    const session = results([{}, {}, {}, { grade: "inaccuracy", score: -0.2 }]);
    expect(sessionRating(session)).toBe(Rating.Good);
  });
});

describe("queue ordering", () => {
  const entry = (id: string, dueDaysAgo: number, leakCostBb = 0) => ({
    id,
    due: new Date(NOW.getTime() - dueDaysAgo * 86_400_000),
    leakCostBb,
  });

  it("ranks a more overdue card higher", () => {
    expect(queuePriority(entry("a", 5), NOW)).toBeGreaterThan(
      queuePriority(entry("b", 1), NOW),
    );
  });

  it("pulls an expensive leak forward", () => {
    // The thing a generic flashcard app cannot do: a node the hand history
    // says is actively costing money outranks one that is merely due.
    const cheap = queuePriority(entry("cheap", 2, 0), NOW);
    const costly = queuePriority(entry("costly", 2, 30), NOW);
    expect(costly).toBeGreaterThan(cheap);
  });

  it("caps how far a leak can jump the queue", () => {
    // An expensive leak should jump; it must not monopolise. A hugely costly
    // leak must not outrank a card that is a month overdue.
    const enormousLeak = queuePriority(entry("leak", 0, 10_000), NOW);
    const veryOverdue = queuePriority(entry("old", 30), NOW);
    expect(veryOverdue).toBeGreaterThan(enormousLeak);
  });

  it("excludes cards that are not yet due", () => {
    const future = {
      id: "future",
      due: new Date(NOW.getTime() + 86_400_000),
      leakCostBb: 0,
    };
    expect(
      selectQueue([future, entry("due", 1)], 10, NOW).map((e) => e.id),
    ).toEqual(["due"]);
  });

  it("caps the session so it stays completable", () => {
    // A queue showing two hundred due cards is one a person stops opening.
    const many = Array.from({ length: 200 }, (_, i) => entry(`c${i}`, i + 1));
    expect(selectQueue(many, 20, NOW)).toHaveLength(20);
  });

  it("returns the most urgent cards when it has to choose", () => {
    const queue = selectQueue(
      [entry("new", 1), entry("old", 40), entry("mid", 10)],
      2,
      NOW,
    );
    expect(queue.map((e) => e.id)).toEqual(["old", "mid"]);
  });
});
