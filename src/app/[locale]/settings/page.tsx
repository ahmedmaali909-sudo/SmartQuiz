import { notFound, redirect } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { updateProfileAction } from "@/lib/profile/actions";
import { getPlayerStats } from "@/lib/game/player";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales } from "@/lib/i18n/config";
import { LogoutIcon, SettingsIcon } from "@/components/icons";

const ERROR_KEYS = ["usernameTaken", "usernameInvalid", "genericError"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings`)}`);

  const { saved, error } = await searchParams;
  const dict = getDictionary(locale);
  const t = dict.settingsPage;
  const player = await getPlayerStats(user);
  const errorMessage =
    error && ERROR_KEYS.includes(error as ErrorKey) ? t[error as ErrorKey] : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="space-y-1.5">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
          <SettingsIcon size={24} />
          {t.title}
        </h1>
        <p className="text-sm text-muted">{t.subtitle}</p>
      </header>

      {saved && (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-200">
          {t.saved}
        </p>
      )}
      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm font-semibold text-rose-200"
        >
          {errorMessage}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-panel/60 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-base font-extrabold">
          {t.account}
        </h2>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-[11px] font-bold tracking-wide text-muted uppercase">
              {t.email}
            </span>
            <input
              type="email"
              value={user.email ?? "—"}
              readOnly
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-muted"
            />
          </label>

          <form action={updateProfileAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />

            <label className="block">
              <span className="text-[11px] font-bold tracking-wide text-muted uppercase">
                {t.username}
              </span>
              <input
                type="text"
                name="username"
                defaultValue={player.ready ? player.username : user.username}
                minLength={3}
                maxLength={24}
                required
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet/60"
              />
              <span className="mt-1 block text-[11px] text-muted">{t.usernameHint}</span>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold tracking-wide text-muted uppercase">
                {t.language}
              </span>
              <select
                name="preferredLocale"
                defaultValue={locale}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-soft px-3 py-2.5 text-sm font-semibold outline-none focus:border-violet/60"
              >
                {locales.map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_LABELS[code] ?? code}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted">{t.languageHint}</span>
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-violet to-indigo px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 sm:w-auto sm:px-5"
            >
              {t.save}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/40 p-5">
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-400/15"
          >
            <LogoutIcon size={16} />
            {t.signOut}
          </button>
        </form>
      </section>
    </div>
  );
}
