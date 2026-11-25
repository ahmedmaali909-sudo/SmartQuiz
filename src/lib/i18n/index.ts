import { defaultLocale, isLocale } from "./config";
import { fr } from "./dictionaries/fr";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import type { Dictionary, Locale } from "./types";

const dictionaries: Record<Locale, Dictionary> = { fr, ar, en };

export function getDictionary(locale: string): Dictionary {
  return dictionaries[isLocale(locale) ? locale : defaultLocale];
}

export function resolveLocale(value: string): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** Replaces {placeholders} in a translated string. */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Dictionary, Locale };
