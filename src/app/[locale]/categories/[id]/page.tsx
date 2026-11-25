import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_BY_ID, CATEGORY_IDS, type CategoryId } from "@/lib/game/categories";
import { startLevelAction } from "@/lib/game/actions";
import { getCategoryStats } from "@/lib/game/community";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayerStats } from "@/lib/game/player";
import { getDictionary, interpolate } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { CompassIcon, GridIcon } from "@/components/icons";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  if (!(CATEGORY_IDS as readonly string[]).includes(id)) notFound();

  const category = CATEGORY_BY_ID[id as CategoryId];
  const dict = getDictionary(locale);
  const t = dict.categoryPage;
  const copy = dict.categories[category.id];

  const [stats, user] = await Promise.all([getCategoryStats(), getCurrentUser()]);
  const player = await getPlayerStats(user);
  const count = stats[category.id]?.questionCount ?? 0;
  const bosses = stats[category.id]?.bossCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href={`/${locale}/categories`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-white"
      >
        <GridIcon size={14} />
        {t.back}
      </Link>

      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8"
        style={{
          backgroundImage: `linear-gradient(135deg, ${category.from}33, ${category.to}22)`,
        }}
      >
        <div className="relative space-y-4">
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl text-2xl"
            style={{ backgroundImage: `linear-gradient(135deg, ${category.from}, ${category.to})` }}
            aria-hidden
          >
            {category.emoji}
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
              {copy.name}
            </h1>
            <p className="mt-1 text-sm text-muted">{copy.tagline}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              {interpolate(t.available, { count })}
            </span>
            <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-cyan">
              {interpolate(dict.common.level, { level: player.adventureLevel })}
            </span>
            {bosses > 0 && (
              <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-rose-200">
                {interpolate(t.bosses, { count: bosses })}
              </span>
            )}
          </div>

          {count === 0 ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm font-semibold text-amber-200">
              {t.empty}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted">{t.hint}</p>
              <form action={startLevelAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="mode" value="category" />
                <input type="hidden" name="category" value={category.id} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-indigo px-5 py-3.5 text-sm font-bold text-white shadow-[0_20px_45px_-20px_rgba(124,77,255,1)] transition hover:brightness-110 sm:w-auto"
                >
                  <CompassIcon size={18} />
                  {t.play}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
