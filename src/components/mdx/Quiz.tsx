/**
 * MDX entry point to the section quiz.
 *
 * Rendered at the bottom of the reading body. Acts only as a launcher — it
 * shows the question count, surfaces any prior best score, and on click
 * flips `vizStore.quizOpen` to `true`. The actual quiz UI is `QuizPanel`,
 * mounted inside `VizPanel`'s lower half.
 *
 * Reads the question list from `QuizContext` so the call site in MDX stays
 * prop-free: `<Quiz />`.
 */

"use client";

import { useVizStore } from "@/store/vizStore";
import { useProgressStore } from "@/store/progressStore";
import { useQuizContext } from "./QuizContext";
import {
  IconTrophy,
  IconCheck,
  IconArrowRight,
  IconRefresh,
} from "@/components/icons";

export function Quiz() {
  const { slug, questions } = useQuizContext();
  const setQuizOpen = useVizStore((s) => s.setQuizOpen);
  const getUnitProgress = useProgressStore((s) => s.getUnitProgress);
  const progress = getUnitProgress(slug);

  // Units without quiz questions (e.g. placeholders) skip the launcher entirely.
  if (questions.length === 0) return null;

  const completed = progress?.completed ?? false;

  return (
    <section className="mt-12 rounded-2xl border border-[color:var(--color-line)] bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-[color:var(--color-ink-900)] text-white">
          <IconTrophy size={16} strokeWidth={2} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
            Lock it in
          </p>
          <p className="text-[15px] font-semibold tracking-tight text-[color:var(--color-ink-900)]">
            Section quiz · {questions.length}{" "}
            {questions.length === 1 ? "question" : "questions"}
          </p>
        </div>
      </div>

      {completed && progress && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70 px-3 py-2">
          <span className="grid place-items-center w-5 h-5 rounded-full bg-emerald-500 text-white">
            <IconCheck size={11} strokeWidth={2.5} />
          </span>
          <span className="text-[13px] font-medium text-emerald-800">
            Completed — {progress.score}/{progress.totalQuestions} on best of{" "}
            {progress.attempts}{" "}
            {progress.attempts === 1 ? "attempt" : "attempts"}
          </span>
        </div>
      )}

      <button
        onClick={() => setQuizOpen(true)}
        className="mt-3 group w-full rounded-xl bg-[color:var(--color-ink-900)] px-4 py-3 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-all hover:bg-[color:var(--color-ink-700)] hover:shadow-lg"
      >
        {completed ? (
          <>
            <IconRefresh size={14} strokeWidth={2} />
            Retake quiz
          </>
        ) : (
          <>
            Take the quiz
            <IconArrowRight
              size={14}
              strokeWidth={2.25}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </>
        )}
      </button>

      <p className="mt-2 text-center text-[11px] text-[color:var(--color-ink-500)]">
        Score 100% to mark this section complete.
      </p>
    </section>
  );
}
