"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type AuthState } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n";

type Props = {
  mode: "login" | "register";
  locale: string;
  dict: Dictionary;
  next?: string;
  /** Dictionary key of an error coming from a redirect (OAuth callback). */
  initialError?: string;
};

const initialState: AuthState = {};

export function AuthForm({ mode, locale, dict, next, initialError }: Props) {
  const t = dict.auth;
  const isRegister = mode === "register";
  const [state, formAction, pending] = useActionState(
    isRegister ? signUpAction : signInAction,
    initialState,
  );

  const errorKey = state.error ?? initialError;
  const errorMessage = errorKey
    ? (t[errorKey as keyof typeof t] ?? t.genericError)
    : null;
  const successMessage = state.success
    ? (t[state.success as keyof typeof t] ?? t.checkEmail)
    : null;

  const fieldClass =
    "w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-sm text-white placeholder:text-muted/50 outline-none transition focus:border-violet/60 focus:ring-2 focus:ring-violet/25";

  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-white/10 bg-panel/70 p-6 shadow-[0_40px_120px_-70px_rgba(124,77,255,1)] backdrop-blur-xl sm:p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
          {isRegister ? t.registerTitle : t.loginTitle}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {isRegister ? t.registerSubtitle : t.loginSubtitle}
        </p>

        {successMessage ? (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-200">
            {successMessage}
          </div>
        ) : (
          <>
            {errorMessage && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm font-semibold text-rose-200"
              >
                {errorMessage}
              </div>
            )}

            <form action={formAction} className="mt-6 space-y-4">
              <input type="hidden" name="locale" value={locale} />
              {next && <input type="hidden" name="next" value={next} />}

              {isRegister && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-muted">
                    {t.username}
                  </span>
                  <input
                    className={fieldClass}
                    name="username"
                    type="text"
                    autoComplete="nickname"
                    required
                    minLength={3}
                    maxLength={24}
                    placeholder={t.usernamePlaceholder}
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-muted">{t.email}</span>
                <input
                  className={fieldClass}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t.emailPlaceholder}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted">
                  {t.password}
                  {!isRegister && (
                    <span className="text-[11px] font-semibold text-violet-300/80">
                      {t.forgot}
                    </span>
                  )}
                </span>
                <input
                  className={fieldClass}
                  name="password"
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  placeholder={t.passwordPlaceholder}
                />
                {isRegister && (
                  <span className="mt-1.5 block text-[11px] text-muted/80">
                    {t.passwordHint}
                  </span>
                )}
              </label>

              {isRegister && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-muted">
                    {t.confirmPassword}
                  </span>
                  <input
                    className={fieldClass}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder={t.passwordPlaceholder}
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-gradient-to-r from-violet to-indigo px-4 py-3 text-sm font-bold text-white shadow-[0_20px_45px_-22px_rgba(124,77,255,1)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? t.submitting : isRegister ? t.signUp : t.signIn}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[11px] font-bold tracking-widest text-muted/60 uppercase">
              <span className="h-px flex-1 bg-white/10" />
              {t.or}
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* A real navigation: the OAuth PKCE verifier cookie is set by the route handler. */}
            <Link
              href={`/${locale}/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              prefetch={false}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white/90 transition hover:border-white/30 hover:bg-white/10"
            >
              <span className="font-black text-cyan">G</span>
              {t.continueGoogle}
            </Link>
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          {isRegister ? t.haveAccount : t.noAccount}{" "}
          <Link
            href={`/${locale}/${isRegister ? "login" : "register"}`}
            className="font-bold text-cyan hover:underline"
          >
            {isRegister ? t.signIn : t.signUp}
          </Link>
        </p>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-muted/60">{t.terms}</p>
      </div>

      <p className="mt-4 text-center text-xs">
        <Link href={`/${locale}`} className="font-semibold text-muted hover:text-white">
          ← {t.backHome}
        </Link>
      </p>
    </div>
  );
}
