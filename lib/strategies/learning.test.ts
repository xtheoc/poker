import { describe, expect, it } from "vitest";
import {
  learningMap,
  nextLesson,
  type LearningProgress,
  type StrategyLearningSystem,
  validateLearningSystem,
} from "./learning";

const SYSTEM: StrategyLearningSystem = {
  sources: [],
  setup: [{ id: "history", label: "Hand histories", required: true }],
  drills: [
    {
      id: "range-grid",
      label: "Range grid",
      description: "Build an opening range.",
      kind: "range",
    },
  ],
  tracking: {
    label: "Example hands",
    filterVersion: "1",
    filter: { gameTypes: ["cash"], maximumBigBlind: 0.02 },
    metricIds: ["hands"],
  },
  lessons: [
    {
      id: "ranges",
      title: "Ranges",
      summary: "Open the right hands.",
      prerequisites: [],
      assets: [],
      mastery: [
        { kind: "drill", drillId: "range-grid", minimumRuns: 2, minimumAccuracy: 90 },
      ],
      playbook: [],
    },
    {
      id: "facing-action",
      title: "Facing action",
      summary: "Decide after a raise.",
      prerequisites: ["ranges"],
      assets: [],
      mastery: [{ kind: "quiz", quizId: "facing-quiz", minimumAttempts: 1, minimumScore: 90 }],
      playbook: [],
    },
  ],
};

function progress(overrides: Partial<LearningProgress> = {}): LearningProgress {
  return { completeSetupIds: [], lessons: [], ...overrides };
}

describe("strategy learning map", () => {
  it("does not unlock learning before required setup is complete", () => {
    expect(learningMap(SYSTEM, progress()).map((item) => item.state)).toEqual(["locked", "locked"]);
  });

  it("opens only the first lesson after setup", () => {
    expect(
      learningMap(SYSTEM, progress({ completeSetupIds: ["history"] })).map((item) => item.state),
    ).toEqual(["available", "locked"]);
  });

  it("keeps the next lesson locked until the prior lesson is explicitly mastered", () => {
    const map = learningMap(
      SYSTEM,
      progress({
        completeSetupIds: ["history"],
        lessons: [
          {
            lessonId: "ranges",
            startedAt: new Date("2026-09-10"),
            masteredAt: null,
            attempts: [
              {
                requirementKind: "drill",
                requirementId: "range-grid",
                score: 95,
                completedAt: new Date("2026-09-10"),
              },
              {
                requirementKind: "drill",
                requirementId: "range-grid",
                score: 91,
                completedAt: new Date("2026-09-10"),
              },
            ],
          },
        ],
      }),
    );
    expect(map.map((item) => item.state)).toEqual(["in-progress", "locked"]);
    expect(map[0]?.requirementsMet).toBe(1);
  });

  it("returns an unfinished lesson before looking for a new one", () => {
    const state = progress({
      completeSetupIds: ["history"],
      lessons: [
        {
          lessonId: "ranges",
          startedAt: new Date("2026-09-10"),
          masteredAt: null,
          attempts: [],
        },
      ],
    });
    expect(nextLesson(SYSTEM, state)?.lesson.id).toBe("ranges");
  });

  it("promotes the next lesson once mastery has been recorded", () => {
    const state = progress({
      completeSetupIds: ["history"],
      lessons: [
        { lessonId: "ranges", startedAt: new Date(), masteredAt: new Date(), attempts: [] },
      ],
    });
    expect(nextLesson(SYSTEM, state)?.lesson.id).toBe("facing-action");
  });

  it("rejects impossible lesson maps", () => {
    expect(() =>
      validateLearningSystem({
        ...SYSTEM,
        lessons: [{ ...SYSTEM.lessons[0]!, prerequisites: ["missing"] }],
      }),
    ).toThrow("unknown lesson missing");
  });

  it("rejects circular lesson dependencies", () => {
    expect(() =>
      validateLearningSystem({
        ...SYSTEM,
        lessons: [
          { ...SYSTEM.lessons[0]!, prerequisites: ["facing-action"] },
          { ...SYSTEM.lessons[1]!, prerequisites: ["ranges"] },
        ],
      }),
    ).toThrow("Circular lesson dependency");
  });
});
