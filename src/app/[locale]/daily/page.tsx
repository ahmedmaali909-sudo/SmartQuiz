import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDailyInfo } from "@/lib/game/community";
import { startLevelAction } from "@/lib/game/actions";
import { getDictionary, interpolate } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { CalendarIcon, CoinIcon, SparkIcon } from "@/components/icons";

export default async function DailyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.dailyPage;
  const user = await getCurrentUser();
  const info = await getDailyInfo(user?.id ?? null);
  const base = `/${locale}`;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gold/15 via-panel/70 to-orange-500/10 p-6 sm:p-8">
        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-gold uppercase">
            <CalendarIcon size={14} />
            {dict.nav.daily}
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              {interpolate(t.questions, { count: info.questionCount })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-gold">
              <CoinIcon size={13} />
              <SparkIcon size={13} />
              {interpolate(t.bonus, { coins: info.coinBonus, xp: info.xpBonus })}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-muted">
              {info.date}
            </span>
          </div>

          {info.result ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <p className="text-sm font-bold text-emerald-200">{t.doneTitle}</p>
              <p className="mt-1 text-sm text-muted">
                {interpolate(t.doneBody, {
                  score: info.result.score,
                  total: info.result.total,
                })}
              </p>
              <Link
                href={base}
                className="mt-3 inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold transition hover:text-white"
              >
                {dict.common.backHome}
              </Link>
            </div>
          ) : user ? (
            <form action={startLevelAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="mode" value="daily" />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-orange-500 px-5 py-3.5 text-sm font-bold text-ink shadow-[0_20px_45px_-20px_rgba(250,204,21,0.8)] transition hover:brightness-110 sm:w-auto"
              >
                <CalendarIcon size={18} />
                {t.start}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t.signIn}</p>
              <Link
                href={`${base}/login?next=${encodeURIComponent(`${base}/daily`)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-indigo px-5 py-3 text-sm font-bold text-white"
              >
                {dict.topbar.login}
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
