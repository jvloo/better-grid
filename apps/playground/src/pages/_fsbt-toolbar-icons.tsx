// Shared toolbar icons for FSBT demo pages. Paths lifted from Lucide
// (https://lucide.dev) — 24x24 canvas, 2px stroke, rounded caps/joins.
// Kept inline rather than as SVG imports so the playground stays
// dependency-light and each icon renders at whatever size/colour the
// caller sets.

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

const baseBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: '1px solid #d0d0d0',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  color: '#344054',
  padding: 0,
};

/** Button with a single SVG icon child; `title` acts as a tooltip. */
export function IconButton({
  title,
  onClick,
  children,
  style,
}: {
  title: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      style={{ ...baseBtnStyle, ...style }}
    >
      {children}
    </button>
  );
}

const svgProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Arrows radiating away from a central axis — "unfold vertical" / expand all. */
export const ExpandAllIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="M12 22v-6" />
    <path d="M12 8V2" />
    <path d="M4 12H2" />
    <path d="M10 12H8" />
    <path d="M16 12h-2" />
    <path d="M22 12h-2" />
    <path d="m15 19-3 3-3-3" />
    <path d="m15 5-3-3-3 3" />
  </svg>
);

/** Arrows converging onto a central axis — "fold vertical" / collapse all. */
export const CollapseAllIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="M12 22v-6" />
    <path d="M12 8V2" />
    <path d="M4 12H2" />
    <path d="M10 12H8" />
    <path d="M16 12h-2" />
    <path d="M22 12h-2" />
    <path d="m15 19-3-3-3 3" />
    <path d="m15 5-3 3-3-3" />
  </svg>
);

/** Downward arrow into a tray — "export / download". */
export const ExportIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);
