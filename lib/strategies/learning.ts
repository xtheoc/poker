/**
 * The learning contract every strategy must satisfy.
 *
 * A strategy is not a collection of charts with a prettier name. It is a
 * sequence of decisions the player can explain, drill and later recognise in
 * their own hands. This module describes that sequence without making any
 * assumptions about a particular book, poker format or drill UI.
 *
 * The definitions live in code rather than in the database. They are teaching
 * material, sourced and reviewed when a strategy is built; user-specific
 * completion and attempts are the data that belong in storage.
 */

export type LearningAssetKind = "rewrite" | "excerpt" | "figure" | "exercise";

export interface StrategySource {
  /** Stable strategy-local identifier, e.g. "main-book". */
  id: string;
  title: string;
  author?: string;
  kind: "book" | "notes" | "video" | "other";
  /** A source may be required before its lessons can be opened. */
  required: boolean;
}

export interface SourceReference {
  /** Stable source identifier within the strategy, never a filesystem path. */
  sourceId: string;
  /** Inclusive source pages. A figure may use a single page. */
  pages: readonly number[];
  /** What the learner should find there, e.g. "opening-range chart". */
  label: string;
}

export interface LearningAsset {
  id: string;
  kind: LearningAssetKind;
  title: string;
  /**
   * Teaching text written for this learner. It can explain a source but must
   * never contradict or silently replace it; source references stay attached.
   */
  body?: string;
  sources: readonly SourceReference[];
}

export type MasteryRequirement =
  | {
      kind: "drill";
      drillId: string;
      /** Number of completed runs required before this requirement can pass. */
      minimumRuns: number;
      /** Required percent correct across the qualifying run. */
      minimumAccuracy?: number;
      /** Minimum answered spots in each qualifying run. */
      minimumAnswers?: number;
      /** Optional ceiling for a qualifying run, used for speed drills. */
      maximumDurationMs?: number;
    }
  | {
      kind: "quiz";
      quizId: string;
      minimumAttempts: number;
      minimumScore: number;
    }
  | {
      kind: "recall";
      minimumAttempts: number;
      minimumScore: number;
    };

export interface PlaybookEntry {
  id: string;
  heading: string;
  takeaway: string;
  sources: readonly SourceReference[];
}

export interface StrategyLesson {
  id: string;
  title: string;
  summary: string;
  /** Every prerequisite must be mastered before this lesson is available. */
  prerequisites: readonly string[];
  assets: readonly LearningAsset[];
  mastery: readonly MasteryRequirement[];
  playbook: readonly PlaybookEntry[];
}

export interface SetupRequirement {
  id: string;
  label: string;
  detail?: string;
  /**
   * A blocker must be complete before the first lesson can unlock. A helpful
   * item is visible but cannot halt progress.
   */
  required: boolean;
}

export interface StrategyTracking {
  /** Plain-language filter displayed to the player and used by the importer. */
  label: string;
  /**
   * Filters are versioned because a revised filter must explain why a hand was
   * assigned at the time; it may never silently rewrite history.
   */
  filterVersion: string;
  /** Machine-readable form used for automatic assignment during import. */
  filter: import("./hand-filter").HandFilter;
  /** IDs of the strategy-specific dashboard statistics. */
  metricIds: readonly string[];
}

export interface StrategyDrill {
  id: string;
  label: string;
  description: string;
  /** The interaction family. The strategy supplies content, the app supplies the UI. */
  kind: "decision" | "range" | "classification" | "sizing" | "recall";
}

export interface StrategyLearningSystem {
  sources: readonly StrategySource[];
  setup: readonly SetupRequirement[];
  lessons: readonly StrategyLesson[];
  drills: readonly StrategyDrill[];
  tracking: StrategyTracking;
}

export interface MasteryAttempt {
  requirementKind: MasteryRequirement["kind"];
  requirementId?: string;
  score?: number;
  durationMs?: number;
  answers?: number;
  completedAt: Date;
}

export interface LessonProgress {
  lessonId: string;
  startedAt: Date | null;
  masteredAt: Date | null;
  attempts: readonly MasteryAttempt[];
}

export interface LearningProgress {
  completeSetupIds: readonly string[];
  lessons: readonly LessonProgress[];
}

export type LessonState = "locked" | "available" | "in-progress" | "mastered";

export interface LearningMapItem {
  lesson: StrategyLesson;
  state: LessonState;
  requirementsMet: number;
  requirementCount: number;
}

function hasSetup(system: StrategyLearningSystem, progress: LearningProgress): boolean {
  const complete = new Set(progress.completeSetupIds);
  return system.setup.every((requirement) => !requirement.required || complete.has(requirement.id));
}

function meetsRequirement(
  requirement: MasteryRequirement,
  attempts: readonly MasteryAttempt[],
): boolean {
  if (requirement.kind === "drill") {
    const relevant = attempts.filter(
      (attempt) =>
        attempt.requirementKind === "drill" && attempt.requirementId === requirement.drillId,
    );
    const passing = relevant.filter(
      (attempt) =>
        (requirement.minimumAccuracy === undefined ||
          (attempt.score ?? 0) >= requirement.minimumAccuracy) &&
        (requirement.minimumAnswers === undefined ||
          (attempt.answers ?? 0) >= requirement.minimumAnswers) &&
        (requirement.maximumDurationMs === undefined ||
          (attempt.durationMs ?? Infinity) <= requirement.maximumDurationMs),
    );
    return passing.length >= requirement.minimumRuns;
  }

  const relevant = attempts.filter((attempt) => {
    if (attempt.requirementKind !== requirement.kind) return false;
    return requirement.kind !== "quiz" || attempt.requirementId === requirement.quizId;
  });
  const passing = relevant.filter((attempt) => (attempt.score ?? 0) >= requirement.minimumScore);
  return relevant.length >= requirement.minimumAttempts && passing.length > 0;
}

/**
 * Derive the map. Nothing writes a "locked" state: availability is always a
 * consequence of setup, prerequisites and evidence, so changing a lesson map
 * cannot leave stale unlock rows behind in a user's account.
 */
export function learningMap(
  system: StrategyLearningSystem,
  progress: LearningProgress,
): LearningMapItem[] {
  const progressByLesson = new Map(progress.lessons.map((item) => [item.lessonId, item]));
  const mastered = new Set(
    progress.lessons.filter((item) => item.masteredAt !== null).map((item) => item.lessonId),
  );
  const setupReady = hasSetup(system, progress);

  return system.lessons.map((lesson) => {
    const item = progressByLesson.get(lesson.id);
    const requirementsMet = lesson.mastery.filter((requirement) =>
      meetsRequirement(requirement, item?.attempts ?? []),
    ).length;
    const prerequisitesMet = lesson.prerequisites.every((id) => mastered.has(id));

    if (mastered.has(lesson.id)) {
      return {
        lesson,
        state: "mastered",
        requirementsMet: lesson.mastery.length,
        requirementCount: lesson.mastery.length,
      };
    }

    if (!setupReady || !prerequisitesMet) {
      return {
        lesson,
        state: "locked",
        requirementsMet,
        requirementCount: lesson.mastery.length,
      };
    }

    return {
      lesson,
      state: item?.startedAt ? "in-progress" : "available",
      requirementsMet,
      requirementCount: lesson.mastery.length,
    };
  });
}

/**
 * The one lesson the dashboard promotes.
 *
 * An unfinished lesson comes first: recording a failed run must never hide it
 * behind a later lesson or make the drill page appear complete. Once that is
 * settled, the first newly available lesson is the natural next step.
 */
export function nextLesson(
  system: StrategyLearningSystem,
  progress: LearningProgress,
): LearningMapItem | null {
  const map = learningMap(system, progress);
  return (
    map.find((item) => item.state === "in-progress") ??
    map.find((item) => item.state === "available") ??
    null
  );
}

/**
 * Fail fast when a strategy author creates a map that can never unlock.
 * These are authoring mistakes, not learner mistakes, so they must surface
 * when the strategy is loaded rather than after somebody completes a lesson.
 */
export function validateLearningSystem(system: StrategyLearningSystem): void {
  const sourceIds = new Set<string>();
  for (const source of system.sources) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate strategy source: ${source.id}`);
    sourceIds.add(source.id);
  }

  const setupIds = new Set<string>();
  for (const requirement of system.setup) {
    if (setupIds.has(requirement.id)) {
      throw new Error(`Duplicate setup requirement: ${requirement.id}`);
    }
    setupIds.add(requirement.id);
  }

  const lessonIds = new Set<string>();
  for (const lesson of system.lessons) {
    if (lessonIds.has(lesson.id)) throw new Error(`Duplicate lesson: ${lesson.id}`);
    lessonIds.add(lesson.id);
  }

  for (const lesson of system.lessons) {
    for (const prerequisite of lesson.prerequisites) {
      if (!lessonIds.has(prerequisite)) {
        throw new Error(`Lesson ${lesson.id} depends on unknown lesson ${prerequisite}`);
      }
      if (prerequisite === lesson.id) {
        throw new Error(`Lesson ${lesson.id} cannot depend on itself`);
      }
    }

    for (const requirement of lesson.mastery) {
      if (
        requirement.kind === "drill" &&
        !system.drills.some((drill) => drill.id === requirement.drillId)
      ) {
        throw new Error(
          `Lesson ${lesson.id} requires unknown drill ${requirement.drillId}`,
        );
      }
    }

    for (const asset of lesson.assets) {
      for (const reference of asset.sources) {
        if (!sourceIds.has(reference.sourceId)) {
          throw new Error(`Lesson ${lesson.id} references unknown source ${reference.sourceId}`);
        }
        if (reference.pages.some((page) => !Number.isInteger(page) || page < 1)) {
          throw new Error(`Lesson ${lesson.id} has an invalid source page`);
        }
      }
    }

    for (const entry of lesson.playbook) {
      for (const reference of entry.sources) {
        if (!sourceIds.has(reference.sourceId)) {
          throw new Error(`Playbook entry ${entry.id} references unknown source ${reference.sourceId}`);
        }
      }
    }
  }

  // A cycle otherwise looks like a learner failure: every lesson remains
  // locked forever. Detect it when the manifest is registered instead.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(system.lessons.map((lesson) => [lesson.id, lesson]));
  const visit = (lessonId: string) => {
    if (visited.has(lessonId)) return;
    if (visiting.has(lessonId)) throw new Error(`Circular lesson dependency at ${lessonId}`);
    visiting.add(lessonId);
    for (const prerequisite of byId.get(lessonId)?.prerequisites ?? []) visit(prerequisite);
    visiting.delete(lessonId);
    visited.add(lessonId);
  };
  for (const lesson of system.lessons) visit(lesson.id);
}
