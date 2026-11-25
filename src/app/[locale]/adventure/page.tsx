import { notFound, redirect } from "next/navigation";
import { startLevelAction } from "@/lib/game/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayerStats } from "@/lib/game/player";
import { interpolate, getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { CoinIcon, CompassIcon, FlameIcon, SparkIcon, TrophyIcon } from "@/components/icons";

export default async function AdventurePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { error } = await searchParams;
  const dict = getDictionary(locale);
  const t = dict.game;

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/adventure`)}`);

  const stats = await getPlayerStats(user);
  const level = stats.adventureLevel;
  const isBoss = level % 10 === 0;
  const questionCount = isBoss ? 15 : 10;
  const bossLevel = Math.ceil(level / 10) * 10;
  const errorMessage =
    error === "no_questions" ? t.noQuestions : error ? t.setupRequired : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet/25 via-panel/70 to-indigo/20 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 end-[-6rem] h-64 w-64 rounded-full bg-cyan/20 blur-3xl" />
        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-cyan uppercase">
            <CompassIcon size={14} />
            {dict.nav.adventure}
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
              {interpolate(dict.common.level, { level })}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{isBoss ? t.bossSubtitle : t.levelSubtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              {interpolate(t.questionsCount, { count: questionCount })}
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">
              {t.passRule}
            </span>
            {isBoss ? (
              <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-rose-200">
                {t.bossBadge}
              </span>
            ) : (
              <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-gold">
                {interpolate(dict.home.bossIn, { level: bossLevel })}
              </span>
            )}
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm font-semibold text-rose-200"
            >
              {errorMessage}
            </div>
          )}

          <form action={startLevelAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="mode" value="adventure" />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-indigo px-5 py-3.5 text-sm font-bold text-white shadow-[0_20px_45px_-20px_rgba(124,77,255,1)] transition hover:brightness-110 sm:w-auto"
            >
              <CompassIcon size={18} />
              {t.start}
            </button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t.coinsLabel, value: stats.coins.toLocaleString(locale), icon: <CoinIcon size={16} />, tone: "text-gold" },
          { label: t.xpLabel, value: stats.xp.toLocaleString(locale), icon: <SparkIcon size={16} />, tone: "text-violet-300" },
          { label: t.streakLabel, value: String(stats.streak), icon: <FlameIcon size={16} />, tone: "text-orange-300" },
          { label: t.rankLabel, value: stats.rank ? `#${stats.rank}` : "—", icon: <TrophyIcon size={16} />, tone: "text-emerald-300" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-panel/60 p-3">
            <span className={`flex items-center gap-1.5 text-[11px] font-bold ${item.tone}`}>
              {item.icon}
              {item.label}
            </span>
            <p className="mt-1 text-lg font-extrabold">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/40 p-5">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-extrabold">
          <FlameIcon size={17} className="text-orange-300" />
          {dict.home.rulesTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">{dict.home.rulesBody}</p>
      </section>
    </div>
  );
}
