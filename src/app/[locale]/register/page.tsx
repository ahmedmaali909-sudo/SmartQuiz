import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}`);

  const { next } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center py-4">
      {isSupabaseConfigured ? (
        <AuthForm mode="register" locale={locale} dict={dict} next={next} />
      ) : (
        <div className="w-full max-w-md rounded-3xl border border-gold/25 bg-gold/[0.06] p-6 sm:p-8">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-extrabold text-gold">
            {dict.auth.notConfiguredTitle}
          </h1>
          <p className="mt-2 text-sm text-muted">{dict.auth.notConfiguredBody}</p>
          <Link
            href={`/${locale}`}
            className="mt-5 inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold transition hover:border-white/30"
          >
            {dict.common.backHome}
          </Link>
        </div>
      )}
    </div>
  );
}
