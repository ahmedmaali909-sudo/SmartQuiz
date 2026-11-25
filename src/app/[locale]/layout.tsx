import type { Metadata, Viewport } from "next";
import { Baloo_2, Cairo, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayerStats } from "@/lib/game/player";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localeDirection, locales } from "@/lib/i18n/config";

const display = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const arabic = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type LocaleParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

export const viewport: Viewport = {
  themeColor: "#05061a",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: React.ReactNode }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  const stats = await getPlayerStats(user);
  const dir = localeDirection[locale];

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${display.variable} ${body.variable} ${arabic.variable}`}
    >
      <body>
        <AppShell
          locale={locale}
          dict={dict}
          user={user}
          stats={{ coins: stats.coins, streak: stats.streak }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
