import { createClient } from "@/lib/supabase/server";

export type GameOption = { id: string; label: string };

export type GameQuestion = {
  id: string;
  prompt: string;
  category: string;
  options: GameOption[];
};

export type PlayState = {
  sessionId: string | null;
  level: number;
  isBoss: boolean;
  total: number;
  answered: number;
  score: number;
  finished: boolean;
  question: GameQuestion | null;
  error?: string;
};

export type AnswerResult = {
  correct: boolean;
  correctOption: string | null;
  explanation: string | null;
  score: number;
  error?: string;
};

export type LevelSummary = {
  status: "passed" | "failed";
  passed: boolean;
  score: number;
  total: number;
  threshold: number;
  coins: number;
  xp: number;
  rp: number;
  level: number;
  adventureLevel: number;
  alreadyFinished?: boolean;
  error?: string;
};

export type StartResult =
  | { sessionId: string; level: number; total: number; isBoss: boolean }
  | { error: string };

/** Raw shapes returned by the SQL functions (snake_case). */
type RawState = {
  session_id?: string;
  level?: number;
  is_boss?: boolean;
  total?: number;
  answered?: number;
  score?: number;
  finished?: boolean;
  question?: {
    id: string;
    prompt: string;
    category: string;
    options: GameOption[];
  } | null;
  error?: string;
};

type RawStart = {
  session_id?: string;
  level?: number;
  total?: number;
  is_boss?: boolean;
  error?: string;
};

type RawAnswer = {
  correct?: boolean;
  correct_option?: string | null;
  explanation?: string | null;
  score?: number;
  error?: string;
};

type RawSummary = {
  status?: "passed" | "failed";
  passed?: boolean;
  score?: number;
  total?: number;
  threshold?: number;
  coins?: number;
  xp?: number;
  rp?: number;
  level?: number;
  adventure_level?: number;
  already_finished?: boolean;
  error?: string;
};

export async function startGame(options: {
  mode?: string;
  category?: string | null;
  level?: number | null;
}): Promise<StartResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("game_start", {
    p_mode: options.mode ?? "adventure",
    p_category: options.category ?? null,
    p_level: options.level ?? null,
  });
  const raw = (data ?? {}) as RawStart;
  if (error || raw.error || !raw.session_id) {
    return { error: raw.error ?? error?.message ?? "unknown" };
  }
  return {
    sessionId: raw.session_id,
    level: raw.level ?? 1,
    total: raw.total ?? 0,
    isBoss: Boolean(raw.is_boss),
  };
}

export async function getPlayState(sessionId: string): Promise<PlayState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("game_state", { p_session: sessionId });
  const raw = (data ?? {}) as RawState;

  if (error || raw.error) {
    return {
      sessionId: null,
      level: 1,
      isBoss: false,
      total: 0,
      answered: 0,
      score: 0,
      finished: true,
      question: null,
      error: raw.error ?? error?.message ?? "unknown",
    };
  }

  return {
    sessionId: raw.session_id ?? sessionId,
    level: raw.level ?? 1,
    isBoss: Boolean(raw.is_boss),
    total: raw.total ?? 0,
    answered: raw.answered ?? 0,
    score: raw.score ?? 0,
    finished: Boolean(raw.finished),
    question: raw.question ?? null,
  };
}

export async function answerQuestion(
  sessionId: string,
  questionId: string,
  optionId: string,
  timeMs?: number,
): Promise<AnswerResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("game_answer", {
    p_session: sessionId,
    p_question: questionId,
    p_option: optionId,
    p_time_ms: timeMs ?? null,
  });
  const raw = (data ?? {}) as RawAnswer;
  if (error || raw.error) {
    return {
      correct: false,
      correctOption: null,
      explanation: null,
      score: 0,
      error: raw.error ?? error?.message ?? "unknown",
    };
  }
  return {
    correct: Boolean(raw.correct),
    correctOption: raw.correct_option ?? null,
    explanation: raw.explanation ?? null,
    score: raw.score ?? 0,
  };
}

export async function finishLevel(sessionId: string): Promise<LevelSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("game_finish", { p_session: sessionId });
  const raw = (data ?? {}) as RawSummary;
  if (error || raw.error) {
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
      error: raw.error ?? error?.message ?? "unknown",
    };
  }
  return {
    status: raw.status ?? "failed",
    passed: Boolean(raw.passed),
    score: raw.score ?? 0,
    total: raw.total ?? 0,
    threshold: raw.threshold ?? 0,
    coins: raw.coins ?? 0,
    xp: raw.xp ?? 0,
    rp: raw.rp ?? 0,
    level: raw.level ?? 1,
    adventureLevel: raw.adventure_level ?? 1,
    alreadyFinished: raw.already_finished,
  };
}
