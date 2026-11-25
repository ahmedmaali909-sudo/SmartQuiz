import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryStats } from "@/lib/game/community";
import { CATEGORIES } from "@/lib/game/categories";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { ArrowRightIcon } from "@/components/icons";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const stats = await getCategoryStats();
  const base = `/${locale}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
          {dict.home.categoriesTitle}
        </h1>
        <p className="max-w-2xl text-sm text-muted">{dict.home.categoriesSubtitle}</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {CATEGORIES.map((category) => {
          const copy = dict.categories[category.id];
          const count = stats[category.id]?.questionCount ?? 0;
          const bosses = stats[category.id]?.bossCount ?? 0;

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
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-muted">
                      {count}
                    </span>
                    {bosses > 0 && (
                      <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                        {dict.game.bossBadge}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
