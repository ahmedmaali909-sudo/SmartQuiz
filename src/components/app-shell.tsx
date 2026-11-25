"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { locales, localeShort } from "@/lib/i18n/config";
import type { AppUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";
import {
  CalendarIcon,
  CloseIcon,
  CoinIcon,
  CompassIcon,
  FlameIcon,
  GridIcon,
  HelpIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  SettingsIcon,
  TrophyIcon,
  UserIcon,
} from "./icons";

type Props = {
  locale: Locale;
  dict: Dictionary;
  user: AppUser | null;
  stats: { coins: number; streak: number };
  children: ReactNode;
};

type NavEntry = { href: string; label: string; icon: ReactNode };

export function AppShell({ locale, dict, user, stats, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const home = `/${locale}`;
  const link = (path: string) => `/${locale}${path}`;

  const groups: Array<{ title: string; items: NavEntry[] }> = [
    {
      title: dict.nav.main,
      items: [
        { href: home, label: dict.nav.home, icon: <HomeIcon /> },
        { href: link("/leaderboard"), label: dict.nav.leaderboard, icon: <TrophyIcon /> },
      ],
    },
    {
      title: dict.nav.play,
      items: [
        { href: link("/adventure"), label: dict.nav.adventure, icon: <CompassIcon /> },
        { href: link("/categories"), label: dict.nav.categories, icon: <GridIcon /> },
        { href: link("/daily"), label: dict.nav.daily, icon: <CalendarIcon /> },
      ],
    },
    {
      title: dict.nav.account,
      items: [
        { href: link("/profile"), label: dict.nav.profile, icon: <UserIcon /> },
        { href: link("/settings"), label: dict.nav.settings, icon: <SettingsIcon /> },
        { href: link("/help"), label: dict.nav.help, icon: <HelpIcon /> },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === home ? pathname === home : pathname.startsWith(href);

  const restPath = pathname.split("/").slice(2).join("/");

  const nav = (
    <nav className="flex flex-1 flex-col gap-7 overflow-y-auto py-6">
      {groups.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="px-3 text-[11px] font-bold tracking-[0.18em] text-muted/70 uppercase">
            {group.title}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                      active
                        ? "bg-violet/15 text-white shadow-[inset_0_0_0_1px_rgba(124,77,255,0.45)]"
                        : "text-muted hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg transition",
                        active
                          ? "bg-violet/25 text-cyan"
                          : "bg-white/5 text-muted group-hover:text-white",
                      )}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const mobileItems: NavEntry[] = [
    { href: home, label: dict.nav.home, icon: <HomeIcon size={20} /> },
    { href: link("/adventure"), label: dict.nav.adventure, icon: <CompassIcon size={20} /> },
    { href: link("/categories"), label: dict.nav.categories, icon: <GridIcon size={20} /> },
    { href: link("/leaderboard"), label: dict.nav.leaderboard, icon: <TrophyIcon size={20} /> },
    { href: link("/profile"), label: dict.nav.profile, icon: <UserIcon size={20} /> },
  ];

  const brand = (
    <Link href={home} className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet to-cyan text-lg font-black text-ink shadow-[0_0_30px_rgba(124,77,255,0.55)]">
        S
      </span>
      <span className="leading-tight">
        <span className="block font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight">
          SmartQuiz
        </span>
        <span className="block text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Quiz Game
        </span>
      </span>
    </Link>
  );

  const accountCard = user ? (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo to-violet text-sm font-bold">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{user.username}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
      </div>
      <form action={signOutAction} className="mt-3">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-muted transition hover:border-rose-400/40 hover:text-rose-300"
        >
          <LogoutIcon size={16} />
          {dict.topbar.logout}
        </button>
      </form>
    </div>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <Link
        href={link("/login")}
        onClick={() => setMenuOpen(false)}
        className="flex items-center justify-center rounded-xl bg-gradient-to-r from-violet to-indigo px-3 py-2 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(124,77,255,0.9)]"
      >
        {dict.topbar.login}
      </Link>
      <Link
        href={link("/register")}
        onClick={() => setMenuOpen(false)}
        className="mt-2 flex items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-muted transition hover:text-white"
      >
        {dict.topbar.signup}
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {menuOpen && (
        <button
          type="button"
          aria-label={dict.topbar.closeMenu}
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-ink/75 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex w-[280px] flex-col border-e border-white/10 bg-ink-soft/95 px-4 py-5 backdrop-blur-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:bg-ink-soft/60",
          menuOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          {brand}
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-muted lg:hidden"
            aria-label={dict.topbar.closeMenu}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        {nav}
        {accountCard}
      </aside>

      <div className="flex min-h-screen flex-col pb-[76px] lg:pb-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-ink/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-muted lg:hidden"
            aria-label={dict.topbar.openMenu}
          >
            <MenuIcon />
          </button>

          <div className="lg:hidden">{brand}</div>

          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold sm:flex">
              <CoinIcon size={15} />
              {stats.coins.toLocaleString(locale)}
              <span className="sr-only">{dict.topbar.coins}</span>
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-xs font-bold text-orange-300 md:flex">
              <FlameIcon size={15} />
              {stats.streak}
              <span className="sr-only">
                {dict.topbar.streak.replace("{days}", String(stats.streak))}
              </span>
            </span>

            <div
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1"
              aria-label={dict.topbar.language}
            >
              {locales.map((code) => (
                <Link
                  key={code}
                  href={`/${code}${restPath ? `/${restPath}` : ""}`}
                  aria-current={code === locale ? "true" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold transition",
                    code === locale
                      ? "bg-violet text-white"
                      : "text-muted hover:text-white",
                  )}
                >
                  {localeShort[code]}
                </Link>
              ))}
            </div>

            {user ? (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo to-violet text-sm font-bold">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <Link
                href={link("/login")}
                className="rounded-full bg-gradient-to-r from-violet to-indigo px-4 py-2 text-xs font-bold text-white shadow-[0_10px_30px_-14px_rgba(124,77,255,1)] transition hover:brightness-110"
              >
                {dict.topbar.login}
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="border-t border-white/5 px-4 py-5 text-xs text-muted/70 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} SmartQuiz · {dict.home.badge}
        </footer>
      </div>

      <nav
        aria-label={dict.nav.main}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-soft/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between gap-0.5 px-2 py-1.5">
          {mobileItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-bold transition",
                    active ? "bg-violet/15 text-cyan" : "text-muted hover:text-white",
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
