"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function updateProfileAction(data: FormData): Promise<void> {
  const rawLocale = data.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : defaultLocale;

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings`)}`);

  const username = String(data.get("username") ?? "").trim();
  const rawPreferred = data.get("preferredLocale");
  const preferred =
    typeof rawPreferred === "string" && isLocale(rawPreferred) ? rawPreferred : locale;

  if (username.length < 3 || username.length > 24) {
    redirect(`/${locale}/settings?error=usernameInvalid`);
  }
  if (!isSupabaseConfigured) {
    redirect(`/${locale}/settings?error=genericError`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username, locale: preferred })
    .eq("id", user.id);

  if (error) {
    const code = (error as { code?: string }).code;
    redirect(`/${locale}/settings?error=${code === "23505" ? "usernameTaken" : "genericError"}`);
  }

  redirect(`/${preferred}/settings?saved=1`);
}
