// ============================================================================
// Grid Layout — 9-zone layout manager for frozen rows/columns
// ============================================================================

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
