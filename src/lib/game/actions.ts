"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import {
  answerQuestion,
  finishLevel,
  getPlayState,
  startGame,
  type AnswerResult,
  type LevelSummary,
  type PlayState,
} from "@/lib/game/engine";

function localeFrom(data: FormData): string {
  const raw = data.get("locale");
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}

/** Starts a level (10 questions, 15 for a boss level) and opens the player. */
export async function startLevelAction(data: FormData): Promise<void> {
  const locale = localeFrom(data);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/adventure`)}`);

  const mode = data.get("mode");
  const category = data.get("category");
  const result = await startGame({
    mode: typeof mode === "string" && mode ? mode : "adventure",
    category: typeof category === "string" && category ? category : null,
  });

  if ("error" in result) {
    redirect(`/${locale}/adventure?error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/${locale}/adventure/play?session=${result.sessionId}`);
}

export async function submitAnswerAction(
  sessionId: string,
  questionId: string,
  optionId: string,
  timeMs = 0,
): Promise<AnswerResult> {
  const user = await getCurrentUser();
  if (!user) return { correct: false, correctOption: null, explanation: null, score: 0, error: "not_authenticated" };
  return answerQuestion(sessionId, questionId, optionId, timeMs);
}

export async function nextQuestionAction(sessionId: string): Promise<PlayState> {
  return getPlayState(sessionId);
}

export async function finishLevelAction(sessionId: string): Promise<LevelSummary> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "failed",
      passed: false,
      score: 0,
      total: 0,
      threshold: 0,
      coins: 0,
      xp: 0,
      rp: 0,
      level: 1,
      adventureLevel: 1,
      error: "not_authenticated",
    };
  }
  return finishLevel(sessionId);
}
