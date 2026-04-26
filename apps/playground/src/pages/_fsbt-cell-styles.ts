// Shared cell-styling tokens used by every FSBT demo grid so they look
// visually consistent with FsbtProgram — which is the reference table.
// Extracted from the inline styling in FsbtProgram.tsx so downstream demos
// (FsbtCost, FsbtRevenue) can reuse it without duplicating
// magic numbers.

export const FSBT_STYLES = {
  /** Background for hierarchy parent rows (level-0 rollups) */
  parentRowBg: '#F8F8F8',
  /** Text colour for parent rows */
  parentText: '#101828',
  /** Text colour for child rows */
  childText: '#282F3D',
  /** Font size for every info-column cell (Code, Phase, dates, etc.) */
  infoFontSize: '12px',
  /** Font weight for parent rows */
  parentFontWeight: '500',
  /** Font weight for child rows */
  childFontWeight: '400',
  /** Left padding used to optically align child text with parent text */
  childIndent: '14px',
  /** Row + header height used by every FSBT grid */
  rowHeight: 44,
  /** Header height used by every FSBT grid */
  headerHeight: 44,
  /** Header background for Program + Cost tables (the production reference's lighter tone) */
  headerBg: '#EAECF0',
  /** Header background for Revenue tables (the production reference's darker tone) */
  revenueHeaderBg: '#D0D5DD',
} as const;

/**
 * getRowStyle callback — paints the parent row's grey background on a single
 * row-wide strip behind the cells, so the bg + divider extend edge-to-edge
 * regardless of per-cell gaps. CSS custom properties like `--bg-input-bg`
 * must stay in {@link parentRowCellStyle} instead, since the strip is a
 * sibling of cells (not an ancestor) and custom properties only inherit
 * down the DOM tree.
 */
export function parentRowStyle(row: unknown): Record<string, string> | undefined {
  const r = row as { parentId: number | null };
  if (r.parentId === null) {
    return { background: FSBT_STYLES.parentRowBg };
  }
  return undefined;
}

/**
 * cellStyle callback that applies the Program table's parent/child styling
 * to any row whose type shape is `{ parentId: number | null }`. Rows with
 * `parentId === null` get the highlighted background + bold weight; children
 * get the muted text colour. Works on any column — attach via `cellStyle`
 * rather than writing a per-column cellRenderer.
 */
export function parentRowCellStyle(_value: unknown, row: unknown): Record<string, string> | undefined {
  const r = row as { parentId: number | null };
  if (r.parentId === null) {
    return {
      background: FSBT_STYLES.parentRowBg,
      fontWeight: FSBT_STYLES.parentFontWeight,
      color: FSBT_STYLES.parentText,
      fontSize: FSBT_STYLES.infoFontSize,
      // Parent rows share the same #F8F8F8 background as the default input box,
      // so the box would disappear. Flip to white on parent rows to match
      // the production reference's cost-table-cell-input.tsx override.
      '--bg-input-bg': '#FFFFFF',
      '--bg-input-hover-bg': FSBT_STYLES.parentRowBg,
    };
  }
  return {
    color: FSBT_STYLES.childText,
    fontSize: FSBT_STYLES.infoFontSize,
    fontWeight: FSBT_STYLES.childFontWeight,
  };
}

/**
 * Variant of {@link parentRowCellStyle} that also applies the child indent
 * on the first text column so the label sits under the parent row name.
 */
export function parentRowCellStyleIndented(_value: unknown, row: unknown): Record<string, string> | undefined {
  const r = row as { parentId: number | null };
  if (r.parentId === null) {
    return {
      background: FSBT_STYLES.parentRowBg,
      fontWeight: FSBT_STYLES.parentFontWeight,
      color: FSBT_STYLES.parentText,
      fontSize: FSBT_STYLES.infoFontSize,
      // Parent rows share the same #F8F8F8 background as the default input box,
      // so the box would disappear. Flip to white on parent rows to match
      // the production reference's cost-table-cell-input.tsx override.
      '--bg-input-bg': '#FFFFFF',
      '--bg-input-hover-bg': FSBT_STYLES.parentRowBg,
    };
  }
  return {
    color: FSBT_STYLES.childText,
    fontSize: FSBT_STYLES.infoFontSize,
    fontWeight: FSBT_STYLES.childFontWeight,
    paddingLeft: FSBT_STYLES.childIndent,
  };
}
