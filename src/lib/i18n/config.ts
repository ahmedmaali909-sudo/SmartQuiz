import type { Locale } from "./types";

export const locales: Locale[] = ["fr", "ar", "en"];

export const defaultLocale: Locale = "fr";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  ar: "rtl",
  en: "ltr",
};

export const localeLabel: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export const localeShort: Record<Locale, string> = {
  fr: "FR",
  ar: "AR",
  en: "EN",
};

export function isLocale(value: string): value is Locale {
  return (locales as string[]).includes(value);
}

/** Builds a locale-prefixed path: localePath("ar", "/login") => "/ar/login". */
export function localePath(locale: Locale, path = ""): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
