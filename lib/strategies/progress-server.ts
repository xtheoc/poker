/** Server-only bridge between Supabase progress rows and the pure map engine. */

import { optionalUser } from "@/lib/session";
import type { LearningProgress } from "./learning";
import { loadStrategyLearningProgress, MissingStrategyTablesError } from "./store";

const EMPTY_PROGRESS: LearningProgress = { completeSetupIds: [], lessons: [] };

export interface StrategyProgressPageData {
  progress: LearningProgress;
  signedIn: boolean;
  migrationMissing: boolean;
}

export async function strategyProgressPageData(
  strategyId: string,
): Promise<StrategyProgressPageData> {
  const session = await optionalUser();
  if (!session) return { progress: EMPTY_PROGRESS, signedIn: false, migrationMissing: false };

  try {
    return {
      progress: await loadStrategyLearningProgress(session.supabase, session.userId, strategyId),
      signedIn: true,
      migrationMissing: false,
    };
  } catch (error) {
    if (error instanceof MissingStrategyTablesError) {
      return { progress: EMPTY_PROGRESS, signedIn: true, migrationMissing: true };
    }
    throw error;
  }
}
