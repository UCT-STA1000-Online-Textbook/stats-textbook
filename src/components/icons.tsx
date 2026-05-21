/**
 * Inline SVG icon set.
 *
 * Each icon is a 24×24 stroke-based glyph that inherits `currentColor`,
 * so the surrounding text colour controls the icon colour. Stroke width and
 * pixel size are configurable per call-site via `size` and `strokeWidth`.
 *
 * Add new icons here — do not pull in an icon-library dependency. Export only
 * what is actually used somewhere in the app to keep the registry honest.
 */

import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  /** Pixel size for both width and height. Defaults to 16. */
  size?: number;
};

/**
 * Shared SVG wrapper. Centralises the viewBox, stroke defaults, and
 * accessibility attributes so that individual icons only declare their paths.
 */
function Base({
  size = 16,
  strokeWidth = 1.75,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Base>
);

export const IconArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Base>
);

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="m15 18-6-6 6-6" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 18 6-6-6-6" />
  </Base>
);

export const IconChevronUp = (p: IconProps) => (
  <Base {...p}>
    <path d="m18 15-6-6-6 6" />
  </Base>
);

/** Hamburger glyph — opens the off-canvas navigation drawer on small screens. */
export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h18" />
  </Base>
);

export const IconSparkles = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="M5 12H1" />
    <path d="M23 12h-4" />
    <path d="m7.05 7.05-1.41-1.41" />
    <path d="m18.36 18.36-1.41-1.41" />
    <path d="m7.05 16.95-1.41 1.41" />
    <path d="m18.36 5.64-1.41 1.41" />
  </Base>
);

export const IconBookOpen = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H10v18H4.5A2.5 2.5 0 0 1 2 17.5z" />
    <path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H14v18h5.5a2.5 2.5 0 0 0 2.5-2.5z" />
  </Base>
);

export const IconLightbulb = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3v1h6v-1c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2Z" />
  </Base>
);

/** Used for the Theorem callout — visually evokes a balance/proof glyph. */
export const IconScale = (p: IconProps) => (
  <Base {...p}>
    <path d="m16 16 3-8 3 8c-1 .5-2 1-3 1s-2-.5-3-1Z" />
    <path d="m2 16 3-8 3 8c-1 .5-2 1-3 1s-2-.5-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </Base>
);

export const IconNote = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M3 18h6" />
    <path d="M3 22h3" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Base>
);

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </Base>
);

export const IconChart = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 3 3 5-6" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
    <path d="M12 9v4" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </Base>
);

export const IconTrophy = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9V3h12v6a6 6 0 0 1-12 0Z" />
    <path d="M6 5H3a3 3 0 0 0 3 4" />
    <path d="M18 5h3a3 3 0 0 1-3 4" />
    <path d="M9 21h6" />
    <path d="M12 15v6" />
  </Base>
);
