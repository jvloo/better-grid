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

/** Two arrows pointing away from a central axis — "expand all". */
export const ExpandAllIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="m7 15 5 5 5-5" />
    <path d="m7 9 5-5 5 5" />
  </svg>
);

/** Two arrows pointing toward a central axis — "collapse all". */
export const CollapseAllIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="m7 20 5-5 5 5" />
    <path d="m7 4 5 5 5-5" />
  </svg>
);

/** Counter-clockwise rotate — "undo". */
export const UndoIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

/** Clockwise rotate — "redo". */
export const RedoIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
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
