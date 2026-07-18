/**
 * Shared accessibility behaviour for the two off-canvas overlays in the
 * three-panel shell (`Sidebar`'s nav drawer, `VizPanel`'s bottom sheet).
 *
 * Both overlays are permanently mounted — visibility toggles via CSS
 * transforms/breakpoints rather than mount/unmount — so this hook has to
 * decide for itself whether the overlay is *currently acting like a modal*
 * before doing anything. That is true only when both:
 *
 *   1. the store flag says it's open, and
 *   2. the viewport is narrower than the breakpoint at which the element
 *      switches from an in-flow panel to an overlay (checked via
 *      `matchMedia`, since Tailwind's breakpoints are CSS-only and have no
 *      JS-visible equivalent).
 *
 * When both hold, the hook:
 *   - moves focus into the container (the first focusable descendant, or
 *     the container itself if it has none),
 *   - traps Tab/Shift+Tab within the container's focusable elements,
 *   - closes on Escape, and
 *   - restores focus to whatever was focused before the overlay opened.
 *
 * Returns a ref to attach to the overlay's root element; the caller is
 * responsible for adding `role="dialog"`, `aria-modal`, and `aria-label`
 * conditionally on the same "is it acting as a modal" test (exposed here
 * as `isModal`) so those attributes don't leak into the in-flow layout.
 */

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/** CSS selector for elements that can receive keyboard focus. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface UseDialogA11yOptions {
  /** Whether the overlay's store flag says it is open. */
  open: boolean;
  /** Called to close the overlay (Escape key, or programmatically). */
  onClose: () => void;
  /** `max-width` media query below which this element behaves as an overlay. */
  breakpointQuery: string;
}

/**
 * Wires up dialog semantics for a permanently-mounted overlay. See file
 * header for the full behaviour. `containerRef` must be attached to the
 * overlay's root DOM node.
 */
export function useDialogA11y<T extends HTMLElement>({
  open,
  onClose,
  breakpointQuery,
}: UseDialogA11yOptions) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Tracks the viewport check separately from `open` — a drawer left open
  // while the window is resized past the breakpoint should drop modal
  // behaviour (and vice versa) without waiting for another open/close.
  // `useSyncExternalStore` (rather than state-in-an-effect) avoids the
  // extra render-after-mount and is the React-recommended way to read a
  // browser API that can change outside of React's control.
  const belowBreakpoint = useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(breakpointQuery);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(breakpointQuery).matches,
    () => false // server snapshot — matches the desktop/in-flow default
  );

  const isModal = open && belowBreakpoint;

  // Focus management: move focus in on becoming modal, restore it on
  // leaving. Only runs on the `isModal` transition, not on every render.
  useEffect(() => {
    if (!isModal) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    const firstFocusable = container?.querySelector<HTMLElement>(
      FOCUSABLE_SELECTOR
    );
    (firstFocusable ?? container)?.focus();

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [isModal]);

  // Escape-to-close and Tab-trap, active only while acting as a modal.
  useEffect(() => {
    if (!isModal) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null); // skip hidden elements
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModal, onClose]);

  return { containerRef, isModal };
}
