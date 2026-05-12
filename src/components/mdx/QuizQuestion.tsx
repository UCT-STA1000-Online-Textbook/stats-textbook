/**
 * Renders a single quiz question — multiple-choice or true/false.
 *
 * Used inside `QuizPanel` (the bottom half of `VizPanel` when the quiz is
 * open). Owns no state of its own; the parent passes the current `selected`
 * value and `submitted` flag and is told about answers via `onAnswer`.
 *
 * Layout: a fixed left "rail" holds the question number badge (24px wide).
 * The question text and option group both indent from that rail using
 * `pl-[34px]` (24px badge + 10px gap), so options visually align under the
 * question text rather than under the badge.
 */

"use client";

import type { QuizQuestion as QuizQuestionType } from "@/lib/mdx";
import { IconCheck, IconClose } from "@/components/icons";

interface Props {
  question: QuizQuestionType;
  /** Zero-based position; rendered as `index + 1` in the badge. */
  index: number;
  /** Currently chosen answer for this question, or undefined if none yet. */
  selected: number | boolean | undefined;
  /** True after the parent quiz has been submitted; locks input + reveals feedback. */
  submitted: boolean;
  onAnswer: (value: number | boolean) => void;
}

/** Indent applied to options + explanation so they align under the question text. */
const RAIL_INDENT = "pl-[34px]";

export function QuizQuestion({
  question,
  index,
  selected,
  submitted,
  onAnswer,
}: Props) {
  const isCorrect = submitted && selected === question.answer;
  const isWrong =
    submitted && selected !== undefined && selected !== question.answer;

  return (
    <div className="space-y-2.5">
      {/* Number badge + question text */}
      <div className="flex items-start gap-2.5">
        <span
          className={`flex-shrink-0 grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold tabular-nums mt-0.5 ${
            submitted
              ? isCorrect
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
              : "bg-slate-100 text-[color:var(--color-ink-700)]"
          }`}
        >
          {index + 1}
        </span>
        <p className="text-[13.5px] leading-relaxed font-medium text-[color:var(--color-ink-900)]">
          {question.question}
        </p>
      </div>

      {question.type === "mcq" && question.options && (
        <div className={`${RAIL_INDENT} space-y-1.5`}>
          {question.options.map((opt, i) => (
            <OptionButton
              key={i}
              label={opt}
              letter={String.fromCharCode(65 + i)}
              selected={selected === i}
              correct={submitted && i === question.answer}
              wrong={submitted && selected === i && i !== question.answer}
              disabled={submitted}
              onClick={() => onAnswer(i)}
            />
          ))}
        </div>
      )}

      {question.type === "true-false" && (
        <div className={`${RAIL_INDENT} flex gap-2`}>
          {([true, false] as const).map((val) => (
            <OptionButton
              key={String(val)}
              label={val ? "True" : "False"}
              selected={selected === val}
              correct={submitted && val === question.answer}
              wrong={submitted && selected === val && val !== question.answer}
              disabled={submitted}
              onClick={() => onAnswer(val)}
              compact
            />
          ))}
        </div>
      )}

      {/* Explanation appears after submission, regardless of correctness. */}
      {submitted && (
        <div
          className={`${RAIL_INDENT} animate-soft-fade`}
        >
          <div
            className={`rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${
              isCorrect
                ? "bg-emerald-50/60 border-emerald-200/70"
                : "bg-red-50/60 border-red-200/70"
            }`}
          >
            <p
              className={`flex items-start gap-1.5 ${
                isCorrect
                  ? "text-emerald-800"
                  : isWrong
                    ? "text-red-800"
                    : "text-[color:var(--color-ink-700)]"
              }`}
            >
              <span
                className={`mt-0.5 inline-grid place-items-center w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                  isCorrect ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                }`}
              >
                {isCorrect ? (
                  <IconCheck size={9} strokeWidth={3} />
                ) : (
                  <IconClose size={9} strokeWidth={3} />
                )}
              </span>
              <span>{question.explanation}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface OptionButtonProps {
  label: string;
  /** Optional A/B/C/… letter; omitted for true/false buttons. */
  letter?: string;
  selected: boolean;
  correct: boolean;
  wrong: boolean;
  disabled: boolean;
  /** True/false buttons sit inline (no full width); MCQ options are full width. */
  compact?: boolean;
  onClick: () => void;
}

/**
 * A single answer option. Visual state is computed from the four flags
 * (`selected`, `correct`, `wrong`, `disabled`). Correctness colours win over
 * the selected colour, so a chosen-but-wrong answer reads as red after submit.
 */
function OptionButton({
  label,
  letter,
  selected,
  correct,
  wrong,
  disabled,
  compact,
  onClick,
}: OptionButtonProps) {
  const base =
    "group relative flex items-center gap-2.5 rounded-lg border text-[13px] transition-all duration-150 disabled:cursor-default";
  const padding = compact ? "px-4 py-2" : "px-3 py-2 w-full text-left";

  // Visual tone — explicit ladder rather than nested ternaries for legibility.
  let tone =
    "bg-white border-[color:var(--color-line)] text-[color:var(--color-ink-700)] hover:border-indigo-300 hover:bg-indigo-50/30";
  if (selected && !correct && !wrong)
    tone =
      "bg-indigo-50/70 border-indigo-300 text-indigo-900 ring-1 ring-indigo-200/60";
  if (correct) tone = "bg-emerald-50 border-emerald-300 text-emerald-900";
  if (wrong) tone = "bg-red-50 border-red-300 text-red-900";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${padding} ${tone}`}
    >
      {letter && (
        <span
          className={`grid place-items-center w-5 h-5 rounded-md text-[10px] font-semibold flex-shrink-0 ${
            correct
              ? "bg-emerald-500 text-white"
              : wrong
                ? "bg-red-500 text-white"
                : selected
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-100 text-[color:var(--color-ink-500)] group-hover:bg-indigo-100 group-hover:text-indigo-700"
          }`}
        >
          {correct ? (
            <IconCheck size={11} strokeWidth={3} />
          ) : wrong ? (
            <IconClose size={11} strokeWidth={3} />
          ) : (
            letter
          )}
        </span>
      )}
      <span className="flex-1">{label}</span>
    </button>
  );
}
