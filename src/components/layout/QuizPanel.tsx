/**
 * The section quiz, rendered inside the right panel beneath the
 * visualisation (see `VizPanel`).
 *
 * Mounted by `VizPanel` whenever `vizStore.quizOpen` is true, so its local
 * answer state is fresh on every open. Reads the question list and unit slug
 * from `QuizContext` (provided by `ThreePanelShell`, so both `Quiz` in MDX
 * and this panel see the same data without prop drilling). On submit it
 * commits the result to `progressStore.completeUnit`, which persists to
 * localStorage.
 *
 * A unit is only considered "complete" when the score equals the number of
 * questions (i.e. 100%) — a deliberate teaching choice: students keep
 * iterating until they actually get every answer right.
 *
 * Layout: `VizPanel` either splits the panel (viz fixed on top, this quiz
 * below) or lets the quiz fill the panel with the viz collapsed to a strip.
 * The title-bar toggle flips between the two; `VizPanel` owns that state and
 * passes it in via `expanded` / `onToggleExpanded`.
 *
 * Wrong answers on a question with a `vizHint` (authored in the unit's quiz
 * frontmatter — see `QuizQuestionSchema` in `src/lib/mdx.ts`) get a "See the
 * visualisation" affordance once the quiz is submitted. Clicking it loads
 * that viz via `vizStore.setViz` and, if the quiz is currently in the
 * expanded layout (viz collapsed to a strip), reuses `onToggleExpanded` to
 * fall back to the split layout so the viz is actually visible.
 */

"use client";

import { useState } from "react";
import { useVizStore } from "@/store/vizStore";
import { useProgressStore, QuizAnswer } from "@/store/progressStore";
import { useQuizContext } from "@/components/mdx/QuizContext";
import { QuizQuestion } from "@/components/mdx/QuizQuestion";
import { toVizParams } from "@/components/mdx/vizParams";
import {
  IconClose,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconTrophy,
} from "@/components/icons";

interface QuizPanelProps {
  /** True when the quiz fills the whole panel (viz collapsed to a strip). */
  expanded: boolean;
  /** Flip between the split layout and the quiz-expanded layout. */
  onToggleExpanded: () => void;
}

export function QuizPanel({ expanded, onToggleExpanded }: QuizPanelProps) {
  const { slug, questions } = useQuizContext();
  const setViz = useVizStore((s) => s.setViz);
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

  /**
   * Loads a question's hinted visualisation. If the quiz is currently
   * filling the panel (viz collapsed to a strip), fall back to the split
   * layout so the newly-loaded viz is on screen rather than hidden.
   */
  const handleShowHint = (
    vizId: string,
    vizHintParams?: Record<string, unknown>
  ) => {
    setViz(vizId, toVizParams(vizHintParams));
    if (expanded) onToggleExpanded();
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
            <span className="grid place-items-center w-6 h-6 rounded-md bg-blue-50 text-blue-600">
              <IconTrophy size={13} strokeWidth={2} />
            </span>
            <h3 className="text-[13px] font-semibold tracking-tight text-[color:var(--color-ink-900)]">
              Section quiz
            </h3>
          </div>
          <div className="flex items-center gap-0.5">
            {/* Expand the quiz over the viz, or restore the split. */}
            <button
              onClick={onToggleExpanded}
              aria-label={expanded ? "Restore split view" : "Expand quiz"}
              title={expanded ? "Restore split view" : "Expand quiz"}
              className="grid place-items-center w-7 h-7 rounded-md text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-900)] hover:bg-slate-100 transition-colors"
            >
              {expanded ? (
                <IconChevronDown size={14} strokeWidth={2} />
              ) : (
                <IconChevronUp size={14} strokeWidth={2} />
              )}
            </button>
            <button
              onClick={() => setQuizOpen(false)}
              className="grid place-items-center w-7 h-7 rounded-md text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-900)] hover:bg-slate-100 transition-colors"
              aria-label="Close quiz"
            >
              <IconClose size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="progressbar"
            aria-label="Quiz progress"
            aria-valuenow={submitted ? 100 : Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="flex-1 h-1 rounded-full bg-[color:var(--color-line)] overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                passed
                  ? "bg-emerald-500"
                  : submitted
                    ? "bg-amber-500"
                    : "bg-blue-500"
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
            onShowHint={
              q.vizHint
                ? () => handleShowHint(q.vizHint!, q.vizHintParams)
                : undefined
            }
          />
        ))}
      </div>

      {/* Footer: submit before, result card after */}
      <div className="flex-shrink-0 border-t border-[color:var(--color-line)] p-4 bg-white">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
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
