import { NextResponse } from "next/server";
import { generateQuestions, isAiConfigured } from "@/lib/ai/generate";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/generate
 * Headers: x-admin-secret: $ADMIN_SECRET
 * Body: { categoryId, locale, count, boss?, difficulty? }
 *
 * Never reachable without the secret; results are written with the service
 * role because `question_options` is closed to players.
 */
export async function POST(request: Request) {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret || request.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = (body ?? {}) as {
    categoryId?: string;
    locale?: string;
    count?: number;
    boss?: boolean;
    difficulty?: number;
  };

  const locale = input.locale === "ar" || input.locale === "en" ? input.locale : "fr";

  try {
    const result = await generateQuestions({
      categoryId: String(input.categoryId ?? ""),
      locale,
      count: Number(input.count ?? 10),
      boss: Boolean(input.boss),
      difficulty: Number(input.difficulty ?? 2),
    });
    return NextResponse.json(result, { status: result.inserted > 0 ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
