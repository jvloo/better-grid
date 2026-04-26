// ============================================================================
// Rendering Pipeline — DOM-based cell rendering with pooling
// ============================================================================
// ARIA note: cells are absolutely positioned — there is no per-row container
// element to mark with role="row". aria-rowindex on each gridcell is the
// documented substitute when row grouping is omitted.

import type { CellRenderContext, CellRenderer, CellTypeRenderer, ColumnDef, Selection } from '../types';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCellRenderContext = CellRenderContext<any>;
import type { LayoutMeasurements } from '../virtualization/engine';
import { isCellActive, isCellInSelection } from '../selection/model';
import { getCellValue, snapToDevicePixel } from '../utils';

// Encode row:col into a single number to avoid string allocation per cell
const MAX_COLS = 16384; // 2^14 — supports up to 16K columns
function cellKey(row: number, col: number): number {
  return row * MAX_COLS + col;
}

// Apply a style record to an element, routing CSS custom properties through
// setProperty (Object.assign silently drops `--*` keys because CSSStyleDeclaration
// only recognizes spec-defined slots).
//
// Tracks previously-applied keys on the element so repeat applications clear
// anything the previous cellStyle/rowStyle set but the new one doesn't.
// Prevents stale styles leaking across pool reuse when a cell gets reassigned
// to a different data row (e.g. after hierarchy collapse/expand shifts rows).
interface StyledElement extends HTMLElement {
  __bgAppliedStyleKeys?: string[];
}
// CSSStyleDeclaration.setProperty expects kebab-case for spec-defined properties.
// Callers pass camelCase ({fontWeight: '600'}), so convert before forwarding.
// Custom properties (`--foo`) and already-kebab keys pass through untouched.
function toKebab(key: string): string {
  if (key.charCodeAt(0) === 45 /* '-' */) return key; // --custom or already kebab
  let out = '';
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    if (c >= 65 && c <= 90 /* A-Z */) out += '-' + key[i]!.toLowerCase();
    else out += key[i];
  }
  return out;
}
function applyCellStyles(el: HTMLElement, styles: Record<string, string>): void {
  const styled = el as StyledElement;
  // Clear any keys the previous application set that this one doesn't include
  const prev = styled.__bgAppliedStyleKeys;
  if (prev && prev.length > 0) {
    for (const prevKey of prev) {
      if (prevKey in styles && styles[prevKey] != null) continue;
      el.style.removeProperty(toKebab(prevKey));
    }
  }
  const appliedKeys: string[] = [];
  for (const key in styles) {
    const value = styles[key];
    if (value == null) continue;
    appliedKeys.push(key);
    el.style.setProperty(toKebab(key), value);
  }
  styled.__bgAppliedStyleKeys = appliedKeys;
}

// Reset applyCellStyles' tracking so a subsequent call starts fresh — used
// when a cell is recycled (pool → new row) and its cssText has been cleared
// externally, so we shouldn't try to remove properties that are already gone.
function resetAppliedStyles(el: HTMLElement): void {
  (el as StyledElement).__bgAppliedStyleKeys = undefined;
}

export class RenderingPipeline<TData = unknown> {
  private cellPool = new Map<number, HTMLElement>();
  private cleanupFns = new Map<number, () => void>();
  private cellTypes = new Map<string, CellTypeRenderer>();
  private globalCellRenderer: CellRenderer<TData> | null = null;
  /** Frozen cells keyed by numeric key with their base left offset */
  private frozenCells = new Map<number, { element: HTMLElement; baseLeft: number; top: number }>();
  /** Recycled DOM elements ready for reuse — avoids remove()/appendChild() churn */
  private recyclePool: HTMLElement[] = [];
  /** Reused per renderCells() to avoid per-frame Set allocation */
  private visibleKeys = new Set<number>();
  /** Per-row style callback — paints a full-width strip behind cells */
  getRowStyle: ((row: TData, rowIndex: number) => Record<string, string> | undefined) | undefined;
  /** Live context ref — read every render so handler swaps don't require re-init. */
  contextRef?: { current: unknown };
  /** Pool of row-background strip elements keyed by data row index */
  private rowBgPool = new Map<number, HTMLElement>();
  /** Recycled row-bg strips awaiting reuse */
  private rowBgRecyclePool: HTMLElement[] = [];
  /** Reused per renderCells() to track which row strips are still visible */
  private visibleRowBgs = new Set<number>();

  setGlobalCellRenderer(renderer: CellRenderer<TData> | null): void {
    this.globalCellRenderer = renderer;
  }

  registerCellType(type: string, renderer: CellTypeRenderer): () => void {
    this.cellTypes.set(type, renderer);
    return () => {
      this.cellTypes.delete(type);
    };
  }

  getCellType(type: string): CellTypeRenderer | undefined {
    return this.cellTypes.get(type);
  }

  /** Render visible cells into a container element */
  renderCells(
    container: HTMLElement,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
    data: TData[],
    columns: ColumnDef<TData>[],
    measurements: LayoutMeasurements,
    selection: Selection,
    frozenLeftColumns = 0,
    scrollLeft = 0,
    frozenTopRows = 0,
  ): void {
    const visibleKeys = this.visibleKeys;
    visibleKeys.clear();

    // Phase 1: Collect cells to visible set, identify which are new
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        visibleKeys.add(cellKey(row, col));
      }
    }

    // Phase 1.5: Render row-background strips (if getRowStyle is configured).
    // Strips span the full content width behind cells so the row bg + divider
    // extend continuously regardless of per-cell gaps. Painted before cells so
    // cell backgrounds layer on top naturally.
    if (this.getRowStyle) {
      const visibleRowBgs = this.visibleRowBgs;
      visibleRowBgs.clear();
      const totalWidth = measurements.colOffsets[measurements.colOffsets.length - 1] ?? 0;
      for (let row = startRow; row < endRow; row++) {
        visibleRowBgs.add(row);
      }
      // Recycle invisible row bgs
      for (const [row, el] of this.rowBgPool) {
        if (!visibleRowBgs.has(row)) {
          this.rowBgRecyclePool.push(el);
          this.rowBgPool.delete(row);
        }
      }
      // Render visible row bgs, reusing recycled elements
      for (let row = startRow; row < endRow; row++) {
        let strip = this.rowBgPool.get(row);
        if (!strip) {
          strip = this.rowBgRecyclePool.pop() ?? null;
          if (strip) {
            strip.className = 'bg-row-bg';
            strip.style.cssText = 'position: absolute';
            resetAppliedStyles(strip);
          } else {
            strip = document.createElement('div');
            strip.className = 'bg-row-bg';
            strip.style.position = 'absolute';
            container.appendChild(strip);
          }
          strip.dataset.row = String(row);
          strip.setAttribute('aria-hidden', 'true');
          this.rowBgPool.set(row, strip);
        }
        const top = snapToDevicePixel(measurements.rowOffsets[row]!);
        const height = snapToDevicePixel(measurements.rowOffsets[row + 1]!) - top;
        strip.style.transform = `translate3d(0px, ${top}px, 0)`;
        strip.style.width = `${totalWidth}px`;
        strip.style.height = `${height}px`;

        // Always call applyCellStyles (with {} when getRowStyle returns
        // undefined) so keys from the previous row's styles get cleared.
        // Without this, a strip reassigned from a parent row (grey bg) to
        // a child row (no bg) would keep the stale grey.
        const rowData = data[row];
        const rs = rowData !== undefined ? this.getRowStyle(rowData, row) : undefined;
        applyCellStyles(strip, rs ?? {});
      }
    }

    // Phase 2: Recycle cells no longer visible (keep in DOM, move to recycle pool)
    for (const [key, element] of this.cellPool) {
      if (!visibleKeys.has(key)) {
        this.cleanupFns.get(key)?.();
        this.cleanupFns.delete(key);
        this.frozenCells.delete(key);
        this.recyclePool.push(element);
        this.cellPool.delete(key);
      }
    }

    // Phase 3: Render visible cells, reusing recycled elements
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const key = cellKey(row, col);

        let cell = this.cellPool.get(key);
        if (!cell) {
          // Reuse a recycled element (already in DOM) or create new
          cell = this.recyclePool.pop() ?? null;
          if (cell) {
            // Reset recycled element — clear stale inline styles from plugins
            cell.className = 'bg-cell';
            cell.style.cssText = 'position: absolute';
            resetAppliedStyles(cell);
          } else {
            cell = document.createElement('div');
            cell.className = 'bg-cell';
            cell.style.position = 'absolute';
            container.appendChild(cell);
          }
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.dataset.rowEven = row % 2 === 0 ? '1' : '0';
          // ARIA indices are 1-based; data-* stays 0-based to match existing code
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('aria-rowindex', String(row + 1));
          cell.setAttribute('aria-colindex', String(col + 1));
          this.cellPool.set(key, cell);
        }
        cell.className = 'bg-cell';

        // Position — snap to device pixel boundaries for crisp rendering at all zoom levels
        const top = snapToDevicePixel(measurements.rowOffsets[row]!);
        const left = snapToDevicePixel(measurements.colOffsets[col]!);
        const height = snapToDevicePixel(measurements.rowOffsets[row + 1]!) - top;
        const width = snapToDevicePixel(measurements.colOffsets[col + 1]!) - left;

        cell.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        cell.style.width = `${width}px`;
        cell.style.height = `${height}px`;
        cell.style.lineHeight = `${height}px`;

        // Frozen left columns: offset by scrollLeft to keep them visible
        if (col < frozenLeftColumns) {
          cell.classList.add('bg-cell--frozen-left');
          cell.style.transform = `translate3d(${snapToDevicePixel(left + scrollLeft)}px, ${top}px, 0)`;
          this.frozenCells.set(key, { element: cell, baseLeft: left, top });
        } else {
          cell.classList.remove('bg-cell--frozen-left');
          this.frozenCells.delete(key);
        }

        // Last frozen column/row border emphasis
        cell.classList.toggle('bg-cell--frozen-col-last', col === frozenLeftColumns - 1);
        cell.classList.toggle('bg-cell--frozen-row-last', frozenTopRows > 0 && row === frozenTopRows - 1);

        // Selection classes
        const selected = isCellInSelection(row, col, selection);
        const active = isCellActive(row, col, selection);
        cell.classList.toggle('bg-cell--selected', selected);
        cell.classList.toggle('bg-cell--active', active);

        // Build context
        const column = columns[col]!;
        const rowData = data[row]!;
        const value = getCellValue(rowData, column, row);

        const context: CellRenderContext<TData> = {
          rowIndex: row,
          colIndex: col,
          row: rowData,
          column,
          value,
          isSelected: selected,
          isActive: active,
          style: { top, left, width, height },
          context: this.contextRef?.current,
        };

        // Cleanup previous render
        this.cleanupFns.get(key)?.();

        // Apply column-level alignment before render (renderer can override)
        cell.style.textAlign = column.align ?? '';
        cell.style.verticalAlign = column.verticalAlign ?? '';
        // Flex-compatible alignment (for themes that set display:flex on cells)
        if (column.align === 'center') cell.style.justifyContent = 'center';
        else if (column.align === 'right') cell.style.justifyContent = 'flex-end';
        else cell.style.justifyContent = '';

        // Render priority: column renderer > cell type > global > default text
        let cleanup: void | (() => void) = undefined;
        if (column.cellRenderer) {
          cleanup = column.cellRenderer(cell, context);
        } else if (column.cellType && this.cellTypes.has(column.cellType)) {
          cleanup = this.cellTypes.get(column.cellType)!.render(cell, context as AnyCellRenderContext);
        } else if (this.globalCellRenderer) {
          cleanup = this.globalCellRenderer(cell, context);
        } else if (column.valueFormatter) {
          cell.textContent = column.valueFormatter(value, rowData as never);
        } else {
          cell.textContent = value != null ? String(value) : '';
        }

        if (cleanup) {
          this.cleanupFns.set(key, cleanup);
        }

        // Apply column-level styles (cellStyle). Row-level styles are handled
        // by the row-bg strip (Phase 1.5) — applyCellStyles' clear-old-keys
        // logic still runs so stale styles from a previous data row (after
        // hierarchy collapse/expand or scroll reuse) get wiped before new
        // ones land.
        const combinedStyles = column.cellStyle?.(value, rowData as never, row) ?? null;
        applyCellStyles(cell, combinedStyles ?? {});

        if (column.cellClass) {
          const cls = column.cellClass(value, rowData as never, row);
          if (cls) cell.className += ' ' + cls;
        }

      }
    }

    // Phase 4: Remove excess recycled elements from DOM (only if pool is oversized).
    // Keep up to 1.5x the visible footprint as a buffer so the next scroll/resize
    // tick can reuse pooled DOM instead of allocating fresh — the previous code
    // drained both pools every frame, defeating the entire pooling design.
    const cellCap = Math.ceil(visibleKeys.size * 1.5);
    while (this.recyclePool.length > cellCap) {
      this.recyclePool.pop()!.remove();
    }
    const visibleRows = Math.max(0, endRow - startRow);
    const rowBgCap = Math.ceil(visibleRows * 1.5);
    while (this.rowBgRecyclePool.length > rowBgCap) {
      this.rowBgRecyclePool.pop()!.remove();
    }
  }

  /** Synchronously update frozen cell positions — call from scroll handler to avoid lag */
  updateFrozenPositions(scrollLeft: number): void {
    for (const { element, baseLeft, top } of this.frozenCells.values()) {
      element.style.transform = `translate3d(${snapToDevicePixel(baseLeft + scrollLeft)}px, ${top}px, 0)`;
    }
  }

  /** Clear all rendered cells */
  clear(): void {
    for (const [key, element] of this.cellPool) {
      this.cleanupFns.get(key)?.();
      element.remove();
    }
    for (const el of this.recyclePool) el.remove();
    this.recyclePool.length = 0;
    this.frozenCells.clear();
    this.cellPool.clear();
    this.cleanupFns.clear();
    for (const el of this.rowBgPool.values()) el.remove();
    for (const el of this.rowBgRecyclePool) el.remove();
    this.rowBgPool.clear();
    this.rowBgRecyclePool.length = 0;
  }
}
