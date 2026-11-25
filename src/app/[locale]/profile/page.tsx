import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayerStats } from "@/lib/game/player";
import { interpolate, getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { CoinIcon, CompassIcon, FlameIcon, SparkIcon, TrophyIcon } from "@/components/icons";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.profile;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/profile`)}`);

  const stats = await getPlayerStats(user);
  const memberSince = stats.createdAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(stats.createdAt))
    : null;

  const tiles = [
    { label: t.coins, value: stats.coins.toLocaleString(locale), icon: <CoinIcon size={18} />, tone: "text-gold" },
    { label: t.xp, value: stats.xp.toLocaleString(locale), icon: <SparkIcon size={18} />, tone: "text-violet-300" },
    { label: t.level, value: String(stats.level), icon: <CompassIcon size={18} />, tone: "text-cyan" },
    { label: t.rp, value: stats.rp.toLocaleString(locale), icon: <TrophyIcon size={18} />, tone: "text-emerald-300" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet/25 via-panel/70 to-indigo/20 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo to-violet text-2xl font-black">
            {stats.username.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
              {stats.username}
            </h1>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <Link
            href={`/${locale}/adventure`}
            className="ms-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-indigo px-4 py-2.5 text-sm font-bold text-white shadow-[0_20px_45px_-24px_rgba(124,77,255,1)] transition hover:brightness-110"
          >
            <CompassIcon size={17} />
            {dict.home.playNow}
          </Link>
        </div>
      </header>

      {!stats.ready && (
        <div className="rounded-2xl border border-gold/25 bg-gold/[0.07] p-4">
          <p className="text-sm font-bold text-gold">{t.setupTitle}</p>
          <p className="mt-1 text-xs text-muted">{t.setupBody}</p>
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-panel/60 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
          {t.statsTitle}
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className={`flex items-center gap-2 text-xs font-semibold ${tile.tone}`}>
                {tile.icon}
                {tile.label}
              </span>
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-2xl font-extrabold">
                {tile.value}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-orange-300">
              <FlameIcon size={16} />
              {t.streak}
            </span>
            <p className="mt-1.5 text-xl font-extrabold">{stats.streak}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-orange-200/80">
              <FlameIcon size={16} />
              {t.bestStreak}
            </span>
            <p className="mt-1.5 text-xl font-extrabold">{stats.bestStreak}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-cyan">
              <TrophyIcon size={16} />
              {t.rank}
            </span>
            <p className="mt-1.5 text-xl font-extrabold">
              {stats.rank ? `#${stats.rank}` : t.unranked}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <article className="rounded-2xl border border-white/10 bg-panel/60 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            {t.adventureTitle}
          </h2>
          <p className="mt-1 text-xs text-muted">{t.adventureBody}</p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-violet/30 bg-violet/10 px-4 py-3">
            <span className="text-sm font-bold text-violet-200">
              {interpolate(dict.common.level, { level: stats.adventureLevel })}
            </span>
            <span className="text-[11px] text-muted">
              {interpolate(dict.home.bossIn, {
                level: Math.ceil(stats.adventureLevel / 10) * 10,
              })}
            </span>
          </div>
          <Link
            href={`/${locale}/adventure`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold transition hover:border-violet/50 hover:bg-violet/15"
          >
            <CompassIcon size={17} />
            {dict.home.adventureCta}
          </Link>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/60 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            {t.accountTitle}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">{t.username}</dt>
              <dd className="font-semibold">{stats.username}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">{t.email}</dt>
              <dd className="truncate font-semibold">{user.email}</dd>
            </div>
            {memberSince && (
              <div>
                <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">
                  {t.memberSince}
                </dt>
                <dd className="font-semibold">{memberSince}</dd>
              </div>
            )}
          </dl>

          <form action={signOutAction} className="mt-5">
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-muted transition hover:border-rose-400/40 hover:text-rose-300"
            >
              {dict.topbar.logout}
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
