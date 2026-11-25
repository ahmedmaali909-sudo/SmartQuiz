import { defaultLocale } from "@/lib/i18n/config";

/** Only allow internal, single-slash paths as post-login destination. */
export function safeNext(value: string | null | undefined, locale: string): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return `/${locale}`;
}

/** Absolute OAuth / e-mail confirmation callback URL. */
export function callbackUrl(locale: string, next?: string | null): string {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    `http://localhost:${process.env.PORT ?? 3000}`;
  const target = safeNext(next, isKnownLocale(locale) ? locale : defaultLocale);
  return `${site}/${locale}/auth/callback?next=${encodeURIComponent(target)}`;
}

function isKnownLocale(locale: string): boolean {
  return locale === "fr" || locale === "ar" || locale === "en";
}
