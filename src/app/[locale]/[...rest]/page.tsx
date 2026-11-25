import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { CompassIcon } from "@/components/icons";

export default async function PendingSectionPage({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}) {
  const { locale, rest } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const section = rest[1] ?? rest[0] ?? "";

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-violet/30 bg-violet/10 text-cyan">
        <CompassIcon size={28} />
      </span>
      <span className="mt-5 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-cyan uppercase">
        {dict.common.soon}
      </span>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-extrabold sm:text-3xl">
        {dict.common.placeholderTitle}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted">{dict.common.placeholderBody}</p>
      {section && (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] text-muted">
          /{section}
        </p>
      )}
      <Link
        href={`/${locale}`}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-indigo px-5 py-2.5 text-sm font-bold text-white"
      >
        {dict.common.backHome}
      </Link>
    </div>
  );
}
