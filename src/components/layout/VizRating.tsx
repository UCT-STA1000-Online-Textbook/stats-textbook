/**
 * "Rate" control in the visualisation panel's header bar.
 *
 * A small button opens a pop-over card where the student gives the current
 * visualisation 1 to 5 stars and, if they like, a short comment. Saving
 * writes to `feedbackStore` (one rating per viz, saved in this browser only)
 * and shows a thank-you note. Once a viz is rated, the button shows the
 * student's stars so they can see, and change, what they gave.
 *
 * The card closes on Escape, on a click outside it, or with its Close button.
 * Closing it puts keyboard focus back on the Rate button, so a keyboard user
 * keeps their place (and, on phones, stays inside the bottom sheet's focus
 * trap instead of falling out to the page behind it).
 * `VizPanel` keys this component on the viz id, so switching to a different
 * visualisation always starts from a closed, empty card.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedbackStore } from "@/store/feedbackStore";
import { IconClose, IconStar } from "@/components/icons";

/** Plain-language meaning of each star count, read out on hover and focus. */
const STAR_LABELS = ["Not helpful", "A little helpful", "Helpful", "Very helpful", "Excellent"];

/** Longest comment accepted; keeps saved feedback short and readable. */
const MAX_COMMENT = 500;

/** Props for {@link VizRating}. */
interface VizRatingProps {
  /** Registry id of the visualisation being rated. */
  vizId: string;
}

/** Header button plus pop-over card for rating one visualisation. */
export function VizRating({ vizId }: VizRatingProps) {
  const saved = useFeedbackStore((s) => s.ratings[vizId]);
  const rateViz = useFeedbackStore((s) => s.rateViz);

  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  /** Star count under the pointer, previewed before the student clicks. */
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /** Close the card and hand focus back to the Rate button. */
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Close on Escape or on a click anywhere outside the button and card.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Listening in the capture phase and stopping the event here means
      // Escape closes only this card. Without it, the phone bottom sheet's
      // own Escape handler (useDialogA11y) would close the whole panel too.
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      // No focus move here: the student is clicking something else.
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Saving removes the Save button, which held focus; move it to Close so
  // keyboard focus does not drop to the page body.
  useEffect(() => {
    if (justSaved) closeRef.current?.focus();
  }, [justSaved]);

  /** Open the card, pre-filled with any earlier rating so it can be edited. */
  function openCard() {
    setStars(saved?.stars ?? 0);
    setComment(saved?.comment ?? "");
    setHover(0);
    setJustSaved(false);
    setOpen(true);
  }

  function save() {
    if (stars === 0) return;
    rateViz(vizId, stars, comment);
    setJustSaved(true);
  }

  const shown = hover || stars;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openCard())}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--color-ink-500)] hover:text-[color:var(--color-ink-900)] transition-colors"
        title={saved ? `You rated this ${saved.stars} out of 5. Click to change.` : "Rate this visualisation"}
      >
        <IconStar
          size={12}
          strokeWidth={2}
          className={saved ? "fill-amber-400 text-amber-500" : undefined}
        />
        {saved ? `${saved.stars}/5` : "Rate"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Rate this visualisation"
          className="absolute right-0 top-full mt-2 z-20 w-[260px] rounded-xl border border-[color:var(--color-line)] bg-white p-3.5 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-[color:var(--color-ink-900)]">
              {justSaved ? "Thanks for your feedback" : "How useful was this?"}
            </p>
            <button
              ref={closeRef}
              onClick={close}
              aria-label="Close"
              className="-mr-1 -mt-0.5 grid place-items-center w-6 h-6 rounded-md text-[color:var(--color-ink-400)] hover:bg-slate-100 hover:text-[color:var(--color-ink-900)] transition-colors"
            >
              <IconClose size={13} strokeWidth={2} />
            </button>
          </div>

          {justSaved ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--color-ink-500)]">
              Your {stars}-star rating is saved on this device. You can change it at any time.
            </p>
          ) : (
            <>
              <div
                role="group"
                aria-label="Stars out of 5"
                className="mt-2 flex items-center gap-0.5"
                onPointerLeave={() => setHover(0)}
              >
                {STAR_LABELS.map((label, i) => {
                  const value = i + 1;
                  const lit = value <= shown;
                  return (
                    <button
                      key={value}
                      aria-pressed={stars === value}
                      aria-label={`${value} out of 5: ${label}`}
                      onClick={() => setStars(value)}
                      onPointerEnter={() => setHover(value)}
                      className="grid place-items-center w-8 h-8 rounded-md hover:bg-amber-50 transition-colors"
                    >
                      <IconStar
                        size={22}
                        strokeWidth={1.5}
                        className={lit ? "fill-amber-400 text-amber-500" : "text-slate-300"}
                      />
                    </button>
                  );
                })}
              </div>
              {/* Fixed height so the card does not jump as the label appears. */}
              <p className="h-4 mt-0.5 text-[11px] text-[color:var(--color-ink-500)]">
                {shown > 0 ? STAR_LABELS[shown - 1] : ""}
              </p>

              <label className="mt-2 block text-[11px] font-medium text-[color:var(--color-ink-700)]">
                What would make it better? (optional)
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={MAX_COMMENT}
                  rows={3}
                  className="mt-1 block w-full resize-none rounded-md border border-[color:var(--color-line)] px-2 py-1.5 text-[12px] font-normal text-[color:var(--color-ink-900)] focus:border-blue-400 focus:outline-none"
                />
              </label>

              <button
                onClick={save}
                disabled={stars === 0}
                className="mt-2.5 w-full rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
              >
                {stars === 0 ? "Pick a number of stars" : "Save rating"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
