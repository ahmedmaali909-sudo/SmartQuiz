import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { FlameIcon, HelpIcon } from "@/components/icons";

export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.helpPage;
  const faq = [
    { q: t.q1, a: t.a1 },
    { q: t.q2, a: t.a2 },
    { q: t.q3, a: t.a3 },
    { q: t.q4, a: t.a4 },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="space-y-1.5">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
          <HelpIcon size={24} />
          {t.title}
        </h1>
        <p className="text-sm text-muted">{t.subtitle}</p>
      </header>

      <section className="rounded-2xl border border-violet/25 bg-violet/[0.07] p-5">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-extrabold">
          <FlameIcon size={18} className="text-orange-300" />
          {dict.home.rulesTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">{dict.home.rulesBody}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
          {t.faq}
        </h2>
        <ul className="space-y-3">
          {faq.map((item) => (
            <li key={item.q} className="rounded-2xl border border-white/10 bg-panel/50 p-4">
              <p className="text-sm font-bold">{item.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.a}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
