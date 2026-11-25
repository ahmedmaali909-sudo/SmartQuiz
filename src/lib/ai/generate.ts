import { CATEGORY_IDS, CATEGORY_BY_ID, type CategoryId } from "@/lib/game/categories";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phase 7 — AI question generation.
 *
 * Runs on the server only. Any OpenAI-compatible endpoint works (OpenAI,
 * Groq, OpenRouter, Mistral, Gemini, a local server…): the base URL is derived
 * from AI_PROVIDER or set explicitly with AI_BASE_URL. Answers are written with
 * the service role client because `question_options` is not writable by players.
 *
 * AI_API_KEY and AI_MODEL accept comma-separated lists: every model/key pair is
 * tried in order until one answers, so a rate-limited key or model falls through
 * to the next one.
 */

export type GeneratedQuestion = {
  prompt: string;
  explanation: string;
  options: string[];
  correctIndex: number;
  isBoss: boolean;
};

export type GenerationRequest = {
  categoryId: string;
  locale: "fr" | "ar" | "en";
  count: number;
  boss?: boolean;
  difficulty?: number;
};

export type GenerationResult = {
  inserted: number;
  errors: string[];
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
  together: "https://api.together.xyz/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function aiKeys(): string[] {
  return splitList(process.env.AI_API_KEY);
}

export function aiModels(): string[] {
  return splitList(process.env.AI_MODEL);
}

export function aiBaseUrl(): string | null {
  const explicit = process.env.AI_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (provider && PROVIDER_BASE_URLS[provider]) return PROVIDER_BASE_URLS[provider];
  return null;
}

export function isAiConfigured(): boolean {
  return Boolean(aiKeys().length > 0 && aiBaseUrl() && aiModels().length > 0);
}

const LANGUAGE_NAMES: Record<string, string> = {
  fr: "French",
  ar: "Arabic",
  en: "English",
};

function buildPrompt(request: GenerationRequest): string {
  const category = CATEGORY_BY_ID[request.categoryId as CategoryId];
  const label = category?.id ?? request.categoryId;
  return [
    `Write ${request.count} multiple-choice quiz questions about "${label}".`,
    `Language: ${LANGUAGE_NAMES[request.locale] ?? "French"}.`,
    `Difficulty: ${request.difficulty ?? 2} on a 1-5 scale.`,
    request.boss ? "These are BOSS questions: harder, more specific." : "",
    `Every question must have exactly 4 options and exactly 1 correct answer.`,
    `Facts must be verifiable and unambiguous. No numbering inside the prompt.`,
    `Answer with JSON only, no markdown, using this exact shape:`,
    `{"questions":[{"prompt":"...","explanation":"...","options":["a","b","c","d"],"correctIndex":0}]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseQuestions(raw: string, boss: boolean): GeneratedQuestion[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }

  const list = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(list)) return [];

  const out: GeneratedQuestion[] = [];
  for (const item of list) {
    const candidate = item as Partial<GeneratedQuestion>;
    const prompt = typeof candidate.prompt === "string" ? candidate.prompt.trim() : "";
    const explanation =
      typeof candidate.explanation === "string" ? candidate.explanation.trim() : "";
    const options = Array.isArray(candidate.options)
      ? candidate.options.map((option) => String(option).trim()).filter(Boolean)
      : [];
    const correctIndex = Number(candidate.correctIndex);

    if (!prompt || options.length !== 4) continue;
    if (new Set(options).size !== 4) continue;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;

    out.push({ prompt, explanation, options, correctIndex, isBoss: boss });
  }
  return out;
}

/**
 * Tries every model (outer loop) against every key (inner loop) and returns the
 * first usable answer. A failed pair never aborts the whole generation.
 */
async function callModel(request: GenerationRequest): Promise<string> {
  const base = aiBaseUrl();
  if (!base) throw new Error("ai_not_configured");

  const keys = aiKeys();
  const models = aiModels();
  if (keys.length === 0 || models.length === 0) throw new Error("ai_not_configured");

  const failures: string[] = [];

  for (const model of models) {
    for (const key of keys) {
      let response: Response;
      try {
        response = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.8,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are a quiz writer. You always answer with a single valid JSON object and nothing else.",
              },
              { role: "user", content: buildPrompt(request) },
            ],
          }),
        });
      } catch (error) {
        failures.push(`${model}: ${error instanceof Error ? error.message : "network"}`);
        continue;
      }

      if (!response.ok) {
        const detail = await response.text();
        failures.push(`${model}: http_${response.status} ${detail.slice(0, 120)}`);
        continue;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return content;
      failures.push(`${model}: empty_response`);
    }
  }

  throw new Error(`ai_failed: ${failures.join(" | ").slice(0, 300)}`);
}

/** Generates and stores questions. Returns how many were inserted. */
export async function generateQuestions(request: GenerationRequest): Promise<GenerationResult> {
  if (!isAiConfigured()) return { inserted: 0, errors: ["ai_not_configured"] };
  if (!(CATEGORY_IDS as readonly string[]).includes(request.categoryId)) {
    return { inserted: 0, errors: ["unknown_category"] };
  }

  const count = Math.min(Math.max(Number(request.count) || 10, 1), 30);
  const boss = Boolean(request.boss);
  const content = await callModel({ ...request, count, boss });
  const questions = parseQuestions(content, boss);
  if (questions.length === 0) return { inserted: 0, errors: ["unparsable_response"] };

  const admin = createAdminClient();
  const errors: string[] = [];
  let inserted = 0;

  for (const question of questions) {
    const { data: row, error } = await admin
      .from("questions")
      .insert({
        category_id: request.categoryId,
        locale: request.locale,
        prompt: question.prompt,
        explanation: question.explanation || null,
        difficulty: Math.min(Math.max(request.difficulty ?? 2, 1), 5),
        is_boss: boss,
        source: "ai",
      })
      .select("id")
      .single();

    if (error || !row) {
      errors.push(error?.message ?? "insert_failed");
      continue;
    }

    const { error: optionsError } = await admin.from("question_options").insert(
      question.options.map((label, index) => ({
        question_id: row.id,
        label,
        is_correct: index === question.correctIndex,
        position: index,
      })),
    );

    if (optionsError) {
      errors.push(optionsError.message);
      await admin.from("questions").delete().eq("id", row.id);
      continue;
    }

    inserted += 1;
  }

  return { inserted, errors };
}
