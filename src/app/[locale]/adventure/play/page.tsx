import { notFound, redirect } from "next/navigation";
import { LevelPlayer } from "@/components/level-player";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayState } from "@/lib/game/engine";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/adventure`)}`);

  const { session } = await searchParams;
  if (!session) redirect(`/${locale}/adventure`);

  const state = await getPlayState(session);
  if (state.error || !state.sessionId) {
    redirect(`/${locale}/adventure?error=${encodeURIComponent(state.error ?? "session_not_found")}`);
  }

  const dict = getDictionary(locale);
  return <LevelPlayer locale={locale} dict={dict.game} initial={state} />;
}
