"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { callbackUrl, safeNext } from "@/lib/auth/urls";

/**
 * Errors/successes travel back as dictionary keys so the client form can
 * render them in the active language.
 */
export type AuthState = {
  error?: string;
  success?: string;
};

function localeFrom(data: FormData): string {
  const raw = data.get("locale");
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}

function nextPathFrom(data: FormData, locale: string): string {
  const raw = data.get("next");
  return safeNext(typeof raw === "string" ? raw : null, locale);
}

export async function signInAction(
  _prev: AuthState,
  data: FormData,
): Promise<AuthState> {
  const locale = localeFrom(data);
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");

  if (!email || !password) return { error: "missingFields" };
  if (!isSupabaseConfigured) return { error: "notConfiguredBody" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "invalidCredentials" };

  redirect(nextPathFrom(data, locale));
}

export async function signUpAction(
  _prev: AuthState,
  data: FormData,
): Promise<AuthState> {
  const locale = localeFrom(data);
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const confirm = String(data.get("confirmPassword") ?? "");
  const username = String(data.get("username") ?? "").trim();

  if (!email || !password || !username) return { error: "missingFields" };
  if (password.length < 8) return { error: "passwordTooShort" };
  if (password !== confirm) return { error: "passwordMismatch" };
  if (!isSupabaseConfigured) return { error: "notConfiguredBody" };

  const supabase = await createClient();
  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: callbackUrl(locale),
    },
  });

  if (error) return { error: "genericError" };

  // Email confirmation enabled: no session yet.
  if (!result.session) return { success: "checkEmail" };

  redirect(nextPathFrom(data, locale));
}

export async function signOutAction(data: FormData): Promise<void> {
  const locale = localeFrom(data);
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(`/${locale}`);
}

