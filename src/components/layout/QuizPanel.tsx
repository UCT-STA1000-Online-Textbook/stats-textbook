/**
 * The quiz UI itself, rendered in the bottom half of `VizPanel` whenever
 * `vizStore.quizOpen` is true.
 *
 * Reads the question list and unit slug from `QuizContext` (provided one
 * level up by `ThreePanelShell`, so both `Quiz` in MDX and this panel see
 * the same data without prop drilling). On submit it commits the result to
 * `progressStore.completeUnit`, which also persists to localStorage.
 *
 * A unit is only considered "complete" when the score equals the number of
 * questions (i.e. 100%) — a deliberate teaching choice: students keep
 * iterating until they actually get every answer right.
 */

"use client";

import { useState } from "react";
import { useVizStore } from "@/store/vizStore";
import { useProgressStore, QuizAnswer } from "@/store/progressStore";
import { useQuizContext } from "@/components/mdx/QuizContext";
import { QuizQuestion } from "@/components/mdx/QuizQuestion";
import {
  IconClose,
  IconCheck,
  IconRefresh,
  IconTrophy,
} from "@/components/icons";

export function QuizPanel() {
  const { slug, questions } = useQuizContext();
  const setQuizOpen = useVizStore((s) => s.setQuizOpen);
  const completeUnit = useProgressStore((s) => s.completeUnit);

  // Local-only state — answers and submitted flag are not persisted; the
  // best-attempt summary lives in `progressStore` via `completeUnit`.
  const [answers, setAnswers] = useState<Record<string, number | boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (questionId: string, value: number | boolean) => {
    if (!submitted) setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined
  ).length;
  const allAnswered = answeredCount === questions.length;

  const handleSubmit = () => {
    if (!allAnswered) return;
    setSubmitted(true);
    const quizAnswers: QuizAnswer[] = questions.map((q) => ({
      questionId: q.id,
      selectedOption: answers[q.id],
      correct: answers[q.id] === q.answer,
    }));
    const score = quizAnswers.filter((a) => a.correct).length;
    // Phase 2 swap point: this single call becomes a `fetch('/api/progress…')`
    // and the rest of the component continues to work unchanged.
    completeUnit(slug, score, questions.length, quizAnswers);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
  };

  const score = submitted
    ? questions.filter((q) => answers[q.id] === q.answer).length
    : 0;
  const passed = submitted && score === questions.length;

  // Progress bar reflects answer-completion before submit, then snaps to
  // full width once submitted (the bar's colour conveys pass/fail at that point).
  const progressPct =
    questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-[color:var(--color-line)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-6 h-6 rounded-md bg-indigo-50 text-indigo-600">
              <IconTrophy size={13} strokeWidth={2} />
            </span>
            <h3 className="text-[13px] font-semibold tracking-tight text-[color:var(--color-ink-900)]">
              Section quiz
            </h3>
          </div>
          <button
            onClick={() => setQuizOpen(false)}
            className="grid place-items-center w-7 h-7 rounded-md text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-900)] hover:bg-slate-100 transition-colors"
            aria-label="Close quiz"
          >
            <IconClose size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-[color:var(--color-line)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                passed
                  ? "bg-emerald-500"
                  : submitted
                    ? "bg-amber-500"
                    : "bg-indigo-500"
              }`}
              style={{ width: `${submitted ? 100 : progressPct}%` }}
            />
          </div>
          <span className="text-[11px] font-medium tabular-nums text-[color:var(--color-ink-500)]">
            {submitted
              ? `${score}/${questions.length}`
              : `${answeredCount}/${questions.length}`}
          </span>
        </div>
      </div>

      {/* Scrollable list of questions */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {questions.map((q, i) => (
          <QuizQuestion
            key={q.id}
            question={q}
            index={i}
            selected={answers[q.id]}
            submitted={submitted}
            onAnswer={(val) => handleAnswer(q.id, val)}
          />
        ))}
      </div>

      {/* Footer: submit before, result card after */}
      <div className="flex-shrink-0 border-t border-[color:var(--color-line)] p-4 bg-white">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {allAnswered
              ? "Submit answers"
              : `Answer ${questions.length - answeredCount} more`}
          </button>
        ) : passed ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200/70 p-3 animate-soft-fade">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-emerald-500 text-white">
                <IconCheck size={14} strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Perfect — section complete
                </p>
                <p className="text-[11px] text-emerald-700/90">
                  Progress saved. On to the next work unit.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Imperfect score — no completion is recorded; user must retry.
          <div className="rounded-xl bg-amber-50 border border-amber-200/70 p-3">
            <p className="text-sm font-semibold text-amber-900">
              {score} / {questions.length} correct
            </p>
            <p className="text-[11px] text-amber-700/90 mt-0.5">
              Review the explanations, then try again to mark this section
              complete.
            </p>
            <button
              onClick={handleRetry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-amber-900 border border-amber-300 hover:bg-amber-100/40 transition-colors"
            >
              <IconRefresh size={12} strokeWidth={2} />
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
