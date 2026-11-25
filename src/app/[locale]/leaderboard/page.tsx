import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLeaderboard } from "@/lib/game/community";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";
import { TrophyIcon } from "@/components/icons";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.board;
  const [rows, user] = await Promise.all([getLeaderboard(50), getCurrentUser()]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="space-y-1.5">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight sm:text-3xl">
          <TrophyIcon size={26} className="text-gold" />
          {t.title}
        </h1>
        <p className="text-sm text-muted">{t.subtitle}</p>
      </header>

      {rows === null ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-semibold text-amber-200">
          {t.setup}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-panel/50 p-6 text-center text-sm text-muted">
          {t.empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold tracking-wide text-muted uppercase">
                <th className="px-3 py-3 text-start">{t.rank}</th>
                <th className="px-3 py-3 text-start">{t.player}</th>
                <th className="px-3 py-3 text-end">{t.level}</th>
                <th className="hidden px-3 py-3 text-end sm:table-cell">{t.rp}</th>
                <th className="px-3 py-3 text-end">{t.xp}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isMe = user?.id === row.id;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-white/5 last:border-0",
                      isMe ? "bg-violet/10" : "hover:bg-white/[0.03]",
                    )}
                  >
                    <td className="px-3 py-3 font-extrabold">
                      {MEDALS[row.rank - 1] ?? row.rank}
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo to-violet text-[11px] font-bold">
                          {row.username.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate font-semibold">{row.username}</span>
                        {isMe && (
                          <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-[10px] font-bold text-cyan">
                            {t.you}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-end font-semibold text-muted">{row.level}</td>
                    <td className="hidden px-3 py-3 text-end font-semibold text-muted sm:table-cell">
                      {row.rp}
                    </td>
                    <td className="px-3 py-3 text-end font-extrabold text-gold">
                      {row.xp.toLocaleString(locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!user && (
        <div className="rounded-2xl border border-gold/25 bg-gold/[0.07] p-4">
          <p className="text-xs font-semibold text-gold">{t.guestHint}</p>
          <Link
            href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/leaderboard`)}`}
            className="mt-2 inline-flex rounded-xl bg-gradient-to-r from-violet to-indigo px-4 py-2 text-xs font-bold text-white"
          >
            {dict.topbar.login}
          </Link>
        </div>
      )}
    </div>
  );
}
