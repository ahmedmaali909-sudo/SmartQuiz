import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import { callbackUrl, safeNext } from "@/lib/auth/urls";

/**
 * Starts the Google OAuth flow.
 * A route handler is used instead of a Server Action so that the PKCE
 * `code_verifier` cookie is written on a real top-level navigation response.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"), locale);

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=notConfigured`);
  }

  const { url, anonKey } = getSupabaseEnv();
  const pending: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet);
      },
    },
  });

  // Standard OAuth flow: no forced consent screen and no offline access.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(locale, next) },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth`);
  }

  const response = NextResponse.redirect(data.url);
  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, options);
  }
  return response;
}
