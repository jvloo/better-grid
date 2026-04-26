// ============================================================================
// Grid Layout — 9-zone layout manager for frozen rows/columns
// ============================================================================

const DEFAULT_WIDTH = 100;

/** Minimal column shape required for flex width computation. */
interface FlexColumnDef {
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number;
}

/**
 * Compute per-column pixel widths, distributing spare viewport space by `flex`
 * ratio. `width` acts as flex-basis; `minWidth`/`maxWidth` are respected.
 *
 * Algorithm (2-pass clamp-then-redistribute):
 *  1. Assign base widths (clamped to minWidth).
 *  2. For any column with flex > 0: compute tentative share of spare space.
 *     If tentative exceeds maxWidth, clamp and accumulate overflow.
 *  3. Redistribute overflow to remaining unclamped flex columns by their
 *     proportional flex weight. Repeat until no overflow or no unclamped cols.
 */
export function computeColumnWidths(args: {
  columns: FlexColumnDef[];
  viewportWidth: number;
}): number[] {
  const { columns, viewportWidth } = args;

  // Base width for each column (floor at minWidth, default 100 when omitted)
  const widths = columns.map((c) => Math.max(c.minWidth ?? 0, c.width ?? DEFAULT_WIDTH));

  const totalBase = widths.reduce((s, w) => s + w, 0);
  const totalFlex = columns.reduce((s, c) => s + (c.flex ?? 0), 0);
  const spare = viewportWidth - totalBase;

  if (totalFlex <= 0 || spare <= 0) return widths;

  // Iterative 2-pass: distribute, clamp, redistribute overflow until stable.
  // In practice max 2 iterations cover all real cases.
  let remainingSpare = spare;
  const clamped = new Array<boolean>(columns.length).fill(false);

  for (let iter = 0; iter < columns.length; iter++) {
    let remainingFlex = columns.reduce((s, c, i) => s + (clamped[i] ? 0 : (c.flex ?? 0)), 0);
    if (remainingFlex <= 0) break;

    let overflow = 0;
    let anyNewClamp = false;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      if (clamped[i] || !col.flex) continue;

      const share = remainingSpare * (col.flex / remainingFlex);
      const tentative = widths[i]! + share;
      const max = col.maxWidth ?? Infinity;

      if (tentative > max) {
        overflow += tentative - max;
        widths[i] = max;
        clamped[i] = true;
        anyNewClamp = true;
      } else {
        widths[i] = tentative;
      }
    }

    if (!anyNewClamp || overflow === 0) break;

    // There was clamping — subtract what was already distributed to clamped cols
    // and loop to redistribute the overflow to remaining unclamped flex cols.
    remainingSpare = overflow;
  }

  return widths;
}

export type ZoneName =
  | 'frozenTopLeft'
  | 'frozenTop'
  | 'frozenTopRight'
  | 'frozenLeft'
  | 'main'
  | 'frozenRight'
  | 'frozenBottomLeft'
  | 'frozenBottom'
  | 'frozenBottomRight';

export interface LayoutConfig {
  frozenTopRows: number;
  frozenBottomRows: number;
  frozenLeftColumns: number;
  frozenRightColumns: number;
}

export interface ZoneDimensions {
  frozenTopHeight: number;
  frozenBottomHeight: number;
  frozenLeftWidth: number;
  frozenRightWidth: number;
}

/**
 * Compute the pixel dimensions of frozen zones based on row heights and column widths.
 */
export function computeZoneDimensions(
  config: LayoutConfig,
  getRowHeight: (index: number) => number,
  getColWidth: (index: number) => number,
): ZoneDimensions {
  let frozenTopHeight = 0;
  for (let i = 0; i < config.frozenTopRows; i++) {
    frozenTopHeight += getRowHeight(i);
  }

  let frozenBottomHeight = 0;
  for (let i = 0; i < config.frozenBottomRows; i++) {
    frozenBottomHeight += getRowHeight(i); // bottom rows are appended at the end
  }

  let frozenLeftWidth = 0;
  for (let i = 0; i < config.frozenLeftColumns; i++) {
    frozenLeftWidth += getColWidth(i);
  }

  let frozenRightWidth = 0;
  for (let i = 0; i < config.frozenRightColumns; i++) {
    frozenRightWidth += getColWidth(i); // right cols are appended at the end
  }

  return { frozenTopHeight, frozenBottomHeight, frozenLeftWidth, frozenRightWidth };
}
