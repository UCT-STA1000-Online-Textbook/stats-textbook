/**
 * Review mode's page-wide pieces, mounted once by `ThreePanelShell` when
 * review mode is on (see `src/lib/review.ts`):
 *
 *   - `SelectionCommentButton`: when a reviewer highlights text in the reading
 *     panel, a small "Comment" pill appears just below it. Clicking it opens
 *     the comment box with the highlighted words and their place on the page
 *     (section heading, example title) already filled in.
 *   - `ReviewDialog`: the comment box itself, opened by that pill and by the
 *     buttons in `ReviewButtons.tsx`. Sends the comment to `/api/feedback`,
 *     which files it as a GitHub issue, and shows the link when it is logged.
 *
 * Formulas are drawn by KaTeX, which keeps a hidden copy of every formula in
 * the page for screen readers. Copying highlighted text naively would repeat
 * each formula twice, so `quoteFromRange` swaps each formula for its LaTeX
 * source (e.g. `$1 - p$`) instead.
 */

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useReviewStore } from "@/store/reviewStore";
import {
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_IDS,
  MAX_COMMENT,
  MAX_QUOTE,
  type FeedbackPayload,
  type FeedbackTarget,
  type FeedbackTypeId,
} from "@/lib/review";
import { IconClose, IconMessage } from "@/components/icons";

/** Props for {@link ReviewLayer}. */
interface ReviewLayerProps {
  /** Slug of the unit on screen; sent with every comment. */
  slug: string;
}

/** The highlight pill plus the comment box. Render only in review mode. */
export function ReviewLayer({ slug }: ReviewLayerProps) {
  return (
    <>
      <SelectionCommentButton />
      <ReviewDialog slug={slug} />
    </>
  );
}

/** Turn an element-or-text node into the nearest element. */
function elementOf(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement;
}

/**
 * Describe where `el` sits in the reading panel, e.g.
 * "Binomial probabilities › Example 2B". Built from the section headings
 * above it and the titles of any callout cards (Example, Definition, ...)
 * it sits inside. Exported for the Feedback button, which uses the heading
 * nearest the top of the screen.
 */
export function describeLocation(el: Element, body: Element): string {
  let section = "";
  let subsection = "";
  for (const h of body.querySelectorAll("h2, h3")) {
    const before = h.contains(el) || h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (!before) break;
    const text = h.textContent?.trim() ?? "";
    if (h.tagName === "H2") {
      section = text;
      subsection = "";
    } else {
      subsection = text;
    }
  }

  // Callout titles, outermost first (a Solution sits inside its Example).
  const callouts: string[] = [];
  for (let c = el.closest(".callout"); c; c = c.parentElement?.closest(".callout") ?? null) {
    const title = c.querySelector(":scope > header")?.textContent?.trim();
    if (title) callouts.unshift(title);
  }

  return [section, subsection, ...callouts].filter(Boolean).join(" › ");
}

/**
 * Plain text of a highlighted range, with each formula written as its LaTeX
 * source and paragraphs kept on separate lines. Cut to `MAX_QUOTE` characters.
 */
function quoteFromRange(range: Range): string {
  const frag = range.cloneContents();
  frag.querySelectorAll(".katex").forEach((k) => {
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (tex) k.replaceWith(`$${tex.trim()}$`);
  });
  // A highlight that starts or ends part-way through a formula keeps only part
  // of it, possibly without its LaTeX source; drop the hidden copy so the
  // visible part is not doubled.
  frag.querySelectorAll(".katex-mathml").forEach((m) => m.remove());
  frag.querySelectorAll("p, li, h2, h3, h4, tr, div").forEach((b) => b.append("\n"));

  const text = (frag.textContent ?? "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
  return text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE - 3)}...` : text;
}

/** Height of the pill plus a gap, used to decide whether it fits below the highlight. */
const PILL_ROOM = 44;

/**
 * Read the current highlight: its range and what a comment on it would be
 * about. Null when nothing in the reading panel is highlighted.
 */
function readHighlight(): { range: Range; target: FeedbackTarget } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const start = elementOf(range.startContainer);
  const body = start?.closest(".reading-body");
  if (!start || !body || !body.contains(range.endContainer)) return null;

  const quote = quoteFromRange(range);
  if (!quote) return null;
  return { range, target: { kind: "text", quote, location: describeLocation(start, body) } };
}

/**
 * Where to put the pill for `range`, or null when the highlight has scrolled
 * out of the reading panel's visible area (e.g. under the phone top bar).
 */
function pillPosition(range: Range): { top: number; left: number } | null {
  const rect = range.getBoundingClientRect();
  const panel = elementOf(range.startContainer)?.closest("main")?.getBoundingClientRect();
  const visibleTop = panel?.top ?? 0;
  const visibleBottom = panel?.bottom ?? window.innerHeight;
  if (rect.bottom < visibleTop || rect.top > visibleBottom) return null;
  // Below the highlight, where it does not cover the words; above it when
  // the highlight runs to the bottom of the panel.
  const top = rect.bottom + PILL_ROOM < visibleBottom ? rect.bottom + 8 : rect.top - PILL_ROOM;
  // Keep the pill's centre far enough from the edges that it stays on screen.
  const left = Math.min(Math.max(rect.left + rect.width / 2, 60), window.innerWidth - 60);
  return { top, left };
}

/** The "Comment" pill that follows a highlight in the reading panel. */
function SelectionCommentButton() {
  const openComment = useReviewStore((s) => s.openComment);
  const dialogOpen = useReviewStore((s) => s.target !== null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // The highlight is read when it changes, not when the pill is pressed: on
  // phones, tapping the pill can clear the highlight first.
  const pending = useRef<{ range: Range; target: FeedbackTarget } | null>(null);

  useEffect(() => {
    let frame = 0;
    // Reading the highlight copies and cleans its text, so do that only when
    // the highlight changes; scrolling just moves the pill.
    const onSelection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pending.current = readHighlight();
        setPos(pending.current ? pillPosition(pending.current.range) : null);
      });
    };
    const onMove = () => {
      if (!pending.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (pending.current) setPos(pillPosition(pending.current.range));
      });
    };
    document.addEventListener("selectionchange", onSelection);
    // Capture phase: the reading panel scrolls inside its own element, and
    // scroll events do not bubble up to the document.
    document.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", onSelection);
      document.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, []);

  if (!pos || dialogOpen) return null;

  const open = () => {
    if (pending.current) openComment(pending.current.target);
  };

  return (
    <button
      style={{ top: pos.top, left: pos.left }}
      onPointerDown={(e) => {
        // Keeps the highlight in place on desktop when the pill is pressed.
        e.preventDefault();
        // On touch screens, open straight away: by the time "click" fires,
        // the tap may already have cleared the highlight and hidden the pill.
        if (e.pointerType === "touch") open();
      }}
      // Mouse and keyboard.
      onClick={open}
      className="fixed z-30 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
    >
      <IconMessage size={13} strokeWidth={2} />
      Comment
    </button>
  );
}

/** Shows the comment box while the store holds a target. */
function ReviewDialog({ slug }: { slug: string }) {
  const target = useReviewStore((s) => s.target);
  // Mounting afresh on every open means every box starts empty.
  return target ? <DialogCard target={target} slug={slug} /> : null;
}

/** One-line summary of what the comment is about, shown at the top of the box. */
function targetSummary(target: FeedbackTarget): string {
  if (target.kind === "viz") return `Visualisation: ${target.vizId}`;
  if (target.kind === "general") {
    return target.location ? `This unit, near "${target.location}"` : "This unit in general";
  }
  return target.location ?? "";
}

/** The comment box: type, comment, name and (until accepted once) passcode. */
function DialogCard({ target, slug }: { target: FeedbackTarget; slug: string }) {
  const savedName = useReviewStore((s) => s.name);
  const savedPasscode = useReviewStore((s) => s.passcode);
  const closeComment = useReviewStore((s) => s.closeComment);
  const remember = useReviewStore((s) => s.remember);
  const forgetPasscode = useReviewStore((s) => s.forgetPasscode);

  const [type, setType] = useState<FeedbackTypeId>(target.kind === "viz" ? "viz-bug" : "error");
  const [comment, setComment] = useState("");
  const [name, setName] = useState(savedName);
  const [passcode, setPasscode] = useState(savedPasscode);
  // The passcode field shows until the server has accepted one.
  const [askPasscode, setAskPasscode] = useState(!savedPasscode);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Focus the comment field on open, and hand focus back to whatever had it
  // (the button that opened the box) on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    commentRef.current?.focus();
    return () => before?.focus();
  }, []);

  // The box may be dismissed (Escape, backdrop click) only when that loses
  // nothing: not while sending, which could leave a filed comment unseen and
  // invite a duplicate, and not over a comment the reviewer has typed.
  const dismissable = !sending && (comment.trim() === "" || issueUrl !== null);

  // Escape closes the box; Tab stays inside it. Capture phase plus
  // stopPropagation keeps the phone bottom sheet (useDialogA11y), which may be
  // open underneath, from also reacting to these keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        // isComposing: an Escape that cancels typing in an input method editor.
        if (dismissable && !e.isComposing) closeComment();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      e.stopPropagation();
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), textarea, input")
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Focus can drop to the page (e.g. after a click on the card's padding);
      // pull it back in rather than letting Tab wander behind the box.
      if (!cardRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [closeComment, dismissable]);

  const ready = comment.trim() !== "" && name.trim() !== "" && passcode.trim() !== "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    const payload: FeedbackPayload = {
      ...target,
      slug,
      type,
      comment: comment.trim(),
      name: name.trim(),
      passcode: passcode.trim(),
    };
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        remember(payload.name, payload.passcode);
        setIssueUrl(data.url);
        // Clear the highlight, or the pill would offer the same passage again.
        window.getSelection()?.removeAllRanges();
      } else {
        if (res.status === 401) {
          forgetPasscode();
          setPasscode("");
          setAskPasscode(true);
        }
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not reach the site. Check your connection and try again.");
    }
    setSending(false);
  }

  const summary = targetSummary(target);
  const fieldClass =
    "mt-1 block w-full rounded-md border border-[color:var(--color-line)] px-2.5 py-1.5 text-[13px] font-normal text-[color:var(--color-ink-900)] focus:border-blue-400 focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/30 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissable) closeComment();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        className="w-full sm:max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="review-dialog-title" className="text-[14px] font-semibold text-[color:var(--color-ink-900)]">
            {issueUrl ? "Thanks, your comment is logged" : "Comment for the textbook team"}
          </h2>
          <button
            onClick={closeComment}
            aria-label="Close"
            className="-mr-1 -mt-0.5 grid place-items-center w-7 h-7 rounded-md text-[color:var(--color-ink-400)] hover:bg-slate-100 hover:text-[color:var(--color-ink-900)] transition-colors"
          >
            <IconClose size={14} strokeWidth={2} />
          </button>
        </div>

        {issueUrl ? (
          <div className="mt-2 text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">
            <p>It has been filed as an issue for the textbook team.</p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-[color:var(--color-line)] px-3 py-1.5 text-[12px] font-medium text-blue-700 hover:border-blue-400 transition-colors"
              >
                View it on GitHub
              </a>
              <button
                onClick={closeComment}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-2">
            {(summary || target.quote) && (
              <div className="rounded-lg bg-slate-50 border border-[color:var(--color-line)] px-3 py-2 text-[12px] text-[color:var(--color-ink-700)]">
                {summary && <p className="font-medium text-[color:var(--color-ink-900)]">{summary}</p>}
                {target.quote && (
                  <p className="mt-0.5 line-clamp-3 italic whitespace-pre-line">&ldquo;{target.quote}&rdquo;</p>
                )}
              </div>
            )}

            <div role="radiogroup" aria-label="Kind of comment" className="mt-3 grid grid-cols-4 gap-1.5">
              {FEEDBACK_TYPE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={type === id}
                  onClick={() => setType(id)}
                  className={`rounded-md border px-1 py-1.5 text-[12px] font-medium transition-colors ${
                    type === id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-[color:var(--color-line)] text-[color:var(--color-ink-700)] hover:border-blue-400"
                  }`}
                >
                  {FEEDBACK_TYPES[id].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-500)]">{FEEDBACK_TYPES[type].hint}</p>

            <label className="mt-3 block text-[12px] font-medium text-[color:var(--color-ink-700)]">
              What should change?
              <textarea
                ref={commentRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={MAX_COMMENT}
                rows={4}
                className={`${fieldClass} resize-y`}
              />
            </label>

            <label className="mt-3 block text-[12px] font-medium text-[color:var(--color-ink-700)]">
              Your name or initials
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={fieldClass} />
            </label>

            {askPasscode && (
              <label className="mt-3 block text-[12px] font-medium text-[color:var(--color-ink-700)]">
                Reviewer passcode
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  autoComplete="off"
                  className={fieldClass}
                />
                <span className="mt-1 block text-[11px] font-normal text-[color:var(--color-ink-500)]">
                  Only needed once; this browser remembers it.
                </span>
              </label>
            )}

            {error && (
              <p role="alert" className="mt-3 text-[12px] font-medium text-red-700">
                {error}
              </p>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--color-ink-500)]">
              Comments are filed as issues in the project&apos;s public GitHub repository.
            </p>

            <button
              type="submit"
              disabled={!ready || sending}
              className="mt-2 w-full rounded-md bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              {sending ? "Sending..." : "Submit comment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
