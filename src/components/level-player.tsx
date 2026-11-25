"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  finishLevelAction,
  nextQuestionAction,
  submitAnswerAction,
} from "@/lib/game/actions";
import type { AnswerResult, LevelSummary, PlayState } from "@/lib/game/engine";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { CoinIcon, CompassIcon, SparkIcon } from "./icons";

type Props = {
  locale: string;
  dict: Dictionary["game"];
  initial: PlayState;
};

export function LevelPlayer({ locale, dict, initial }: Props) {
  const [state, setState] = useState<PlayState>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [summary, setSummary] = useState<LevelSummary | null>(null);
  const [pending, startTransition] = useTransition();

  const sessionId = state.sessionId;
  const question = state.question;
  const progress = state.total > 0 ? Math.round((state.answered / state.total) * 100) : 0;

  const choose = (optionId: string) => {
    if (!question || !sessionId || selected || pending) return;
    setSelected(optionId);
    startTransition(async () => {
      const answer = await submitAnswerAction(sessionId, question.id, optionId);
      setResult(answer);
    });
  };

  const advance = () => {
    if (!sessionId || pending) return;
    startTransition(async () => {
      const next = await nextQuestionAction(sessionId);
      setState(next);
      setSelected(null);
      setResult(null);
      if (next.finished) {
        const done = await finishLevelAction(sessionId);
        setSummary(done);
      }
    });
  };

  const finishNow = () => {
    if (!sessionId || pending) return;
    startTransition(async () => {
      setSummary(await finishLevelAction(sessionId));
    });
  };

  if (summary) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div
          className={cn(
            "rounded-3xl border p-6 text-center sm:p-8",
            summary.passed
              ? "border-emerald-400/30 bg-emerald-400/[0.07]"
              : "border-rose-400/30 bg-rose-400/[0.07]",
          )}
        >
          <span
            className={cn(
              "grid h-16 w-16 place-items-center rounded-2xl mx-auto",
              summary.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300",
            )}
          >
            <CompassIcon size={28} />
          </span>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-extrabold">
            {summary.passed ? dict.passed : dict.failed}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {dict.score}: <span className="font-bold text-white">{summary.score}</span> / {summary.total}
            {" · "}
            {dict.threshold.replace("{count}", String(summary.threshold))}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-start">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-gold">
                <CoinIcon size={15} /> {dict.coinsEarned}
              </span>
              <p className="mt-1 text-xl font-extrabold">+{summary.coins}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-300">
                <SparkIcon size={15} /> {dict.xpEarned}
              </span>
              <p className="mt-1 text-xl font-extrabold">+{summary.xp}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/adventure`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-indigo px-5 py-3 text-sm font-bold text-white"
            >
              {dict.continueAdventure}
            </Link>
            <Link
              href={`/${locale}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold"
            >
              {dict.backHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-panel/60 p-6 text-center">
        <p className="text-sm text-muted">{state.error ?? dict.noQuestions}</p>
        <button
          type="button"
          onClick={finishNow}
          disabled={pending}
          className="mt-4 rounded-xl bg-gradient-to-r from-violet to-indigo px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {dict.seeResult}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-muted">
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
          {state.isBoss ? dict.bossBadge : dict.levelLabel.replace("{level}", String(state.level))}
        </span>
        <span>
          {state.answered + 1} / {state.total}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet via-indigo to-cyan transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-panel/70 p-5 sm:p-6">
        <p className="font-[family-name:var(--font-display)] text-lg font-extrabold leading-snug sm:text-xl">
          {question.prompt}
        </p>

        <ul className="mt-4 space-y-2.5">
          {question.options.map((option) => {
            const isSelected = selected === option.id;
            const isRight = result?.correctOption === option.id;
            const showRight = Boolean(result) && isRight;
            const showWrong = Boolean(result) && isSelected && !result?.correct;

            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => choose(option.id)}
                  disabled={Boolean(selected) || pending}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-start text-sm font-semibold transition",
                    "border-white/10 bg-white/[0.03] hover:border-violet/40 hover:bg-violet/10",
                    showRight && "border-emerald-400/50 bg-emerald-400/10 text-emerald-100",
                    showWrong && "border-rose-400/50 bg-rose-400/10 text-rose-100",
                    selected && !result && "border-violet/50 bg-violet/10",
                    (selected || pending) && "disabled:cursor-default",
                  )}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[11px] font-black">
                    {option.label.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {result && (
          <div
            className={cn(
              "mt-4 rounded-xl border p-3",
              result.correct
                ? "border-emerald-400/30 bg-emerald-400/10"
                : "border-rose-400/30 bg-rose-400/10",
            )}
          >
            <p
              className={cn(
                "text-sm font-bold",
                result.correct ? "text-emerald-200" : "text-rose-200",
              )}
            >
              {result.correct ? dict.correct : dict.wrong}
            </p>
            {result.explanation && (
              <p className="mt-1 text-xs leading-relaxed text-muted">{result.explanation}</p>
            )}
            {result.error && (
              <p className="mt-1 text-xs font-semibold text-rose-200">{dict.genericError}</p>
            )}
            <button
              type="button"
              onClick={advance}
              disabled={pending}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet to-indigo px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {pending ? dict.loading : dict.next}
            </button>
          </div>
        )}

        {pending && !result && <p className="mt-3 text-xs text-muted">{dict.loading}</p>}
      </div>
    </div>
  );
}
