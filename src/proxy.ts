import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Next.js 16 proxy (the successor of middleware.ts):
 * - refreshes the Supabase auth cookies on every navigation;
 * - redirects unprefixed paths to the default locale (/ → /fr).
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Touching getUser() is what refreshes an expired access token.
    await supabase.auth.getUser();
  }

  const { pathname } = request.nextUrl;

  // API routes (admin jobs, webhooks) are locale-free: never redirected.
  if (pathname.startsWith("/api")) return response;

  const segment = pathname.split("/")[1] ?? "";

  if (!isLocale(segment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
