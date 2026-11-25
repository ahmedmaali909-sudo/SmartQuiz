import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayerStats } from "@/lib/game/player";
import { interpolate, getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { CATEGORIES } from "@/lib/game/categories";
import {
  ArrowRightIcon,
  CalendarIcon,
  CoinIcon,
  CompassIcon,
  FlameIcon,
  SparkIcon,
  TrophyIcon,
} from "@/components/icons";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  const player = await getPlayerStats(user);
  const base = `/${locale}`;

  const statCards = [
    { label: dict.home.statsCoins, value: player.coins.toLocaleString(locale), icon: <CoinIcon size={18} />, tone: "text-gold" },
    { label: dict.home.statsLevel, value: String(player.level), icon: <CompassIcon size={18} />, tone: "text-cyan" },
    { label: dict.home.statsXp, value: player.xp.toLocaleString(locale), icon: <SparkIcon size={18} />, tone: "text-violet-300" },
    { label: dict.home.statsRank, value: player.rank ? `#${player.rank}` : "—", icon: <TrophyIcon size={18} />, tone: "text-emerald-300" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet/25 via-panel/70 to-indigo/20 p-6 shadow-[0_40px_120px_-60px_rgba(124,77,255,0.9)] sm:p-10">
        <div className="pointer-events-none absolute -top-24 end-[-6rem] h-72 w-72 rounded-full bg-cyan/20 blur-3xl" />
        <div className="relative max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-cyan uppercase">
            <SparkIcon size={14} />
            {dict.home.badge}
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            {dict.home.title}{" "}
            <span className="bg-gradient-to-r from-cyan via-violet-300 to-violet bg-clip-text text-transparent">
              {dict.home.titleAccent}
            </span>
          </h1>
          <p className="max-w-xl text-sm text-muted sm:text-base">{dict.home.subtitle}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`${base}/adventure`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-indigo px-5 py-3 text-sm font-bold text-white shadow-[0_20px_45px_-20px_rgba(124,77,255,1)] transition hover:brightness-110"
            >
              {dict.home.playNow}
              <ArrowRightIcon size={18} />
            </Link>
            <Link
              href={`${base}/daily`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/90 transition hover:border-cyan/40 hover:text-white"
            >
              <CalendarIcon size={18} />
              {dict.home.dailyChallenge}
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                {dict.home.dailyHint}
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-white/10 bg-panel/60 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
                {dict.home.adventureTitle}
              </h2>
              <p className="text-xs text-muted">{dict.home.adventureSubtitle}</p>
            </div>
            <span className="rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-[11px] font-bold text-violet-200">
              {interpolate(dict.common.level, { level: player.adventureLevel })}
            </span>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-[11px] font-semibold text-muted">
              <span>{dict.home.adventureSubtitle}</span>
              <span>0 / 10</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[6%] rounded-full bg-gradient-to-r from-violet via-indigo to-cyan" />
            </div>
            <p className="text-[11px] text-muted/80">
              {interpolate(dict.home.bossIn, {
                level: Math.ceil(player.adventureLevel / 10) * 10,
              })}{" "}
              · {dict.common.perLevel}
            </p>
          </div>

          <Link
            href={`${base}/adventure`}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold transition hover:border-violet/50 hover:bg-violet/15"
          >
            <CompassIcon size={17} />
            {dict.home.adventureCta}
          </Link>
        </article>

        <article className="rounded-2xl border border-white/10 bg-panel/60 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            {dict.home.statsTitle}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {statCards.map((stat) => (
              <li key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className={`flex items-center gap-2 text-xs font-semibold ${stat.tone}`}>
                  {stat.icon}
                  {stat.label}
                </span>
                <p className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-extrabold">
                  {stat.value}
                </p>
              </li>
            ))}
          </ul>
          {!user && (
            <div className="mt-4 rounded-xl border border-gold/25 bg-gold/[0.07] p-3">
              <p className="text-xs font-bold text-gold">{dict.home.signInCta}</p>
              <p className="mt-1 text-[11px] text-muted">{dict.home.signInHint}</p>
              <Link
                href={`${base}/login`}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan hover:underline"
              >
                {dict.topbar.login}
                <ArrowRightIcon size={13} />
              </Link>
            </div>
          )}
        </article>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
              {dict.home.categoriesTitle}
            </h2>
            <p className="text-sm text-muted">{dict.home.categoriesSubtitle}</p>
          </div>
          <Link
            href={`${base}/categories`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan hover:underline"
          >
            {dict.nav.categories}
            <ArrowRightIcon size={14} />
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {CATEGORIES.map((category) => {
            const copy = dict.categories[category.id];
            return (
              <li key={category.id}>
                <Link
                  href={`${base}/categories/${category.id}`}
                  className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-panel/50 p-4 transition hover:-translate-y-0.5 hover:border-white/25"
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-15 transition group-hover:opacity-30"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${category.from}, ${category.to})`,
                    }}
                  />
                  <span className="relative flex items-center justify-between">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl text-xl shadow-inner"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${category.from}, ${category.to})`,
                      }}
                      aria-hidden
                    >
                      {category.emoji}
                    </span>
                    <ArrowRightIcon
                      size={16}
                      className="text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 rtl:rotate-180"
                    />
                  </span>
                  <span className="relative">
                    <span className="block text-sm font-bold leading-tight">{copy.name}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted">
                      {copy.tagline}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/40 p-5">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-extrabold">
          <FlameIcon size={18} className="text-orange-300" />
          {dict.home.rulesTitle}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">{dict.home.rulesBody}</p>
      </section>
    </div>
  );
}
