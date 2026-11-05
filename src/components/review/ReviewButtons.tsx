/**
 * Review mode's comment buttons, placed by the panels that own them:
 *
 *   - `CommentButton`: a small text button that opens the comment box for a
 *     given target. `VizPanel` puts one in the visualisation header and
 *     `QuizPanel` one under each quiz question.
 *   - `FeedbackCornerButton`: the "Feedback" button pinned to the bottom
 *     corner of the reading panel, for comments not tied to a particular line.
 *
 * Callers render these only when `REVIEW_MODE` is on (see `src/lib/review.ts`).
 * Comments on highlighted text come from the pill in `ReviewLayer.tsx`.
 */

"use client";

import { useReviewStore } from "@/store/reviewStore";
import type { FeedbackTarget } from "@/lib/review";
import { IconMessage } from "@/components/icons";
import { describeLocation } from "./ReviewLayer";

/** Props for {@link CommentButton}. */
interface CommentButtonProps {
  /** What the comment will be about; read when the button is clicked. */
  target: () => FeedbackTarget;
  /** Button text. */
  label: string;
}

/** Small text button that opens the comment box. */
export function CommentButton({ target, label }: CommentButtonProps) {
  const openComment = useReviewStore((s) => s.openComment);
  return (
    <button
      onClick={() => openComment(target())}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--color-ink-500)] hover:text-blue-700 transition-colors"
    >
      <IconMessage size={12} strokeWidth={2} />
      {label}
    </button>
  );
}

/**
 * How far below the top of the screen a heading can sit and still count as
 * "where the reviewer is reading": roughly the mobile top bar plus a line.
 */
const READING_LINE = 120;

/**
 * Where the reviewer has scrolled to: the place of the last heading that has
 * passed the top of the screen, or "" when they are still above the first one.
 */
function currentScrollLocation(): string {
  const body = document.querySelector(".reading-body");
  if (!body) return "";
  let last: Element | null = null;
  for (const h of body.querySelectorAll("h2, h3")) {
    if (h.getBoundingClientRect().top > READING_LINE) break;
    last = h;
  }
  return last ? describeLocation(last, body) : "";
}

/**
 * The general "Feedback" button. Pinned to the bottom-right of the reading
 * panel by the sticky, zero-height wrapper `ReadingPanel` places it in.
 */
export function FeedbackCornerButton() {
  const openComment = useReviewStore((s) => s.openComment);
  return (
    <button
      onClick={() => openComment({ kind: "general", location: currentScrollLocation() || undefined })}
      className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-line)] bg-white px-3.5 py-2 text-[12px] font-semibold text-[color:var(--color-ink-700)] shadow-md hover:border-blue-400 hover:text-blue-700 transition-colors"
    >
      <IconMessage size={14} strokeWidth={2} />
      Feedback
    </button>
  );
}
