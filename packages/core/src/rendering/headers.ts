// ============================================================================
// Header Renderer — builds header DOM including multi-level headers with
// colSpan/rowSpan, resize handles, filter buttons, and context menu wiring.
//
// Extracted from grid.ts. Accepts all its grid dependencies as constructor
// deps so it can be tested in isolation with mocked DOM + mock callbacks.
// ============================================================================

import type { ColumnDef, HeaderRow, GridState } from '../types';
import type { LayoutMeasurements } from '../virtualization/engine';
import type { Tooltip } from '../ui/tooltip';
import { snapToDevicePixel } from '../utils';

export interface HeaderRendererDeps {
  /** Main header DOM container (scrolls with horizontal scroll) */
  headerContainer: HTMLElement;
  /** Overlay for frozen headers (stays visible, doesn't scroll) */
  frozenHeaderOverlay: HTMLElement | null;
  /** Multi-level header rows config (undefined → single-row auto-generated) */
  headerRows: readonly HeaderRow[] | undefined;
  /** Total header height in px (for single-row mode) */
  headerHeight: number;
  /** Per-row height for multi-level headers */
  singleHeaderRowHeight: number;

  // Services
  tooltip: Tooltip;
  /** Whether the filtering plugin is active (controls filter button visibility) */
  hasFilterPlugin: () => boolean;
  /** Current sort direction for a column (used to emit aria-sort). Optional — omit when sorting plugin absent. */
  getSortState?: (columnId: string) => 'ascending' | 'descending' | 'none';

  // Callbacks
  onHeaderClick: (columnId: string) => void;
  onHeaderContextMenu: (event: MouseEvent, columnId: string) => void;
  onFilterButtonClick: (event: MouseEvent, columnId: string) => void;
  onColumnResize: (colIndex: number, event: PointerEvent) => void;
}

export interface HeaderRenderer<TData = unknown> {
  /** Render headers for the given state + measurements. Idempotent when not invalidated. */
  render(state: GridState<TData>, measurements: LayoutMeasurements): void;
  /** Mark headers as dirty — next render() will rebuild them */
  invalidate(): void;
}

interface HeaderCellOpts {
  left: number;
  top: number;
  width: number;
  height: number;
  content: string | (() => HTMLElement | string);
  colIndex: number;
  isFrozen: boolean;
  isLastFrozenCol: boolean;
  columnId?: string;
  resizable: boolean;
  resizeColIndex?: number;
  resizeHandleTop?: number;
  align?: 'left' | 'center' | 'right';
  /** Number of data columns this cell spans (for aria-colspan). Defaults to 1. */
  colSpan?: number;
}

export function createHeaderRenderer<TData = unknown>(
  deps: HeaderRendererDeps,
): HeaderRenderer<TData> {
  let rendered = false;

  function render(state: GridState<TData>, measurements: LayoutMeasurements): void {
    if (!deps.headerContainer) return;
    if (rendered) return;

    rendered = true;
    deps.headerContainer.innerHTML = '';
    if (deps.frozenHeaderOverlay) deps.frozenHeaderOverlay.innerHTML = '';

    if (deps.headerRows && deps.headerRows.length > 0) {
      renderMultiHeaders(state, measurements);
    } else {
      renderSingleHeaders(state, measurements);
    }
  }

  function invalidate(): void {
    rendered = false;
  }

  function renderSingleHeaders(state: GridState<TData>, measurements: LayoutMeasurements): void {
    for (let col = 0; col < state.columns.length; col++) {
      const column = state.columns[col]! as ColumnDef<TData>;
      const left = measurements.colOffsets[col]!;
      const width = measurements.colOffsets[col + 1]! - left;
      const isFrozen = col < state.frozenLeftColumns;
      const isLastFrozenCol = col === state.frozenLeftColumns - 1;

      const cell = createHeaderCell({
        left,
        top: 0,
        width,
        height: deps.headerHeight,
        content: column.header,
        colIndex: col,
        isFrozen,
        isLastFrozenCol,
        columnId: column.id,
        resizable: column.resizable !== false,
        align: column.align,
      });

      appendHeaderCell(cell, isFrozen);
    }
  }

  function renderMultiHeaders(state: GridState<TData>, measurements: LayoutMeasurements): void {
    const headerRows = deps.headerRows!;
    let topOffset = 0;
    const totalRows = headerRows.length;
    // Track cells occupied by rowSpan from previous rows: "rowIdx:colIdx"
    const occupied = new Set<string>();

    // Track column indices at the right edge of a group span.
    // These columns get resize handles that extend upward to cover the group row.
    const groupSpanEndCols = new Set<number>();
    const frozenCols = state.frozenLeftColumns;

    // Pre-scan all non-last header rows to find group span boundaries
    for (let ri = 0; ri < totalRows - 1; ri++) {
      const hRow = headerRows[ri]!;
      let ci = 0;
      for (const hCell of hRow.cells) {
        const s = hCell.colSpan ?? 1;
        const endC = Math.min(ci + s, state.columns.length);
        if (s > 1) {
          groupSpanEndCols.add(endC - 1);
          // Cross-boundary span: frozen portion's last col is also a group edge
          if (ci < frozenCols && endC > frozenCols) {
            groupSpanEndCols.add(frozenCols - 1);
          }
        }
        ci += s;
      }
    }

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const row = headerRows[rowIdx]!;
      const rowHeight = row.height ?? deps.singleHeaderRowHeight;
      let colIndex = 0;
      let cellIdx = 0;

      while (cellIdx < row.cells.length && colIndex < state.columns.length) {
        // Skip columns occupied by rowSpan from previous rows
        while (colIndex < state.columns.length && occupied.has(`${rowIdx}:${colIndex}`)) {
          colIndex++;
        }
        if (colIndex >= state.columns.length) break;

        const cell = row.cells[cellIdx]!;
        cellIdx++;

        const span = cell.colSpan ?? 1;
        const rSpan = cell.rowSpan ?? 1;

        const left = measurements.colOffsets[colIndex]!;
        const endCol = Math.min(colIndex + span, state.columns.length);
        const height = rowHeight * rSpan;

        // Mark positions occupied by this cell's rowSpan for subsequent rows
        if (rSpan > 1) {
          for (let r = rowIdx + 1; r < rowIdx + rSpan && r < totalRows; r++) {
            for (let c = colIndex; c < endCol; c++) {
              occupied.add(`${r}:${c}`);
            }
          }
        }

        // A cell that spans to the last row acts as a last-row header
        const reachesLastRow = rowIdx + rSpan - 1 === totalRows - 1;

        const startsInFrozen = colIndex < frozenCols;
        const endsInScrollable = endCol > frozenCols;
        const crossesBoundary = startsInFrozen && endsInScrollable && span > 1;

        // Only headers reaching the last row get sort/context menu
        const targetColumnId = reachesLastRow
          ? (cell.columnId ?? state.columns[colIndex]?.id)
          : undefined;

        // Determine if the last column in this span is resizable
        const lastColInSpan = endCol - 1;
        const lastColResizable = state.columns[lastColInSpan]?.resizable !== false;
        // Only last-row headers get resize handles (extended upward to cover group rows)
        const canResize = reachesLastRow && lastColResizable;

        if (crossesBoundary) {
          // Split: frozen portion (cols colIndex..frozenCols-1)
          const frozenWidth = measurements.colOffsets[frozenCols]! - left;
          const frozenLastCol = frozenCols - 1;
          const frozenCanResize = reachesLastRow && state.columns[frozenLastCol]?.resizable !== false;
          const frozenEl = createHeaderCell({
            left,
            top: topOffset,
            width: frozenWidth,
            height,
            content: cell.content,
            colIndex,
            isFrozen: true,
            isLastFrozenCol: true,
            columnId: undefined,
            resizable: frozenCanResize,
            resizeColIndex: frozenLastCol,
            resizeHandleTop: groupSpanEndCols.has(frozenLastCol) ? -topOffset : undefined,
            colSpan: frozenCols - colIndex,
          });
          if (span > 1) frozenEl.classList.add('bg-header-cell--span');
          if (!reachesLastRow) frozenEl.classList.add('bg-header-cell--group');
          appendHeaderCell(frozenEl, true);

          // Split: scrollable continuation (no text — visually extends frozen header)
          const scrollLeft = measurements.colOffsets[frozenCols]!;
          const scrollWidth = measurements.colOffsets[endCol]! - scrollLeft;
          const scrollEl = createHeaderCell({
            left: scrollLeft,
            top: topOffset,
            width: scrollWidth,
            height,
            content: '',
            colIndex: frozenCols,
            isFrozen: false,
            isLastFrozenCol: false,
            columnId: undefined,
            resizable: canResize,
            resizeColIndex: lastColInSpan,
            resizeHandleTop: groupSpanEndCols.has(lastColInSpan) ? -topOffset : undefined,
            colSpan: endCol - frozenCols,
          });
          scrollEl.style.borderLeft = 'none';
          if (span > 1) scrollEl.classList.add('bg-header-cell--span');
          if (!reachesLastRow) scrollEl.classList.add('bg-header-cell--group');
          appendHeaderCell(scrollEl, false);
        } else {
          const isFrozen = startsInFrozen;
          const isLastFrozenCol = endCol - 1 === frozenCols - 1;
          const width = measurements.colOffsets[endCol]! - left;

          const headerEl = createHeaderCell({
            left,
            top: topOffset,
            width,
            height,
            content: cell.content,
            colIndex,
            isFrozen,
            isLastFrozenCol,
            columnId: targetColumnId,
            resizable: canResize,
            resizeColIndex: lastColInSpan,
            resizeHandleTop: reachesLastRow && groupSpanEndCols.has(lastColInSpan) ? -topOffset : undefined,
            colSpan: span,
          });

          if (span > 1) {
            headerEl.classList.add('bg-header-cell--span');
          }
          if (!reachesLastRow) {
            headerEl.classList.add('bg-header-cell--group');
          }

          appendHeaderCell(headerEl, isFrozen);
        }
        colIndex += span;
      }

      topOffset += rowHeight;
    }
  }

  function createHeaderCell(opts: HeaderCellOpts): HTMLElement {
    const cell = document.createElement('div');
    let cls = 'bg-header-cell';
    if (opts.isFrozen) cls += ' bg-header-cell--frozen-left';
    if (opts.isLastFrozenCol) cls += ' bg-header-cell--frozen-col-last';
    cell.className = cls;

    if (opts.align === 'right') cell.style.justifyContent = 'flex-end';
    else if (opts.align === 'center') cell.style.justifyContent = 'center';
    else if (opts.align === 'left') cell.style.justifyContent = 'flex-start';
    cell.style.position = 'absolute';
    cell.style.transform = `translate3d(${snapToDevicePixel(opts.left)}px, ${snapToDevicePixel(opts.top)}px, 0)`;
    cell.style.width = `${snapToDevicePixel(opts.width)}px`;
    cell.style.height = `${snapToDevicePixel(opts.height)}px`;
    cell.dataset.col = String(opts.colIndex);
    cell.dataset.baseLeft = String(opts.left);

    // ARIA: every header cell exposes columnheader role + 1-based colindex.
    // Group headers (span > 1) also expose aria-colspan so multi-column spans
    // are announced accurately by screen readers.
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-colindex', String(opts.colIndex + 1));
    const span = opts.colSpan ?? 1;
    if (span > 1) {
      cell.setAttribute('aria-colspan', String(span));
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'bg-header-cell__text';
    if (typeof opts.content === 'function') {
      const content = opts.content();
      if (typeof content === 'string') {
        textSpan.textContent = content;
      } else {
        textSpan.appendChild(content);
      }
    } else {
      textSpan.textContent = opts.content;
    }
    cell.appendChild(textSpan);

    // Show tooltip on hover when text is clipped
    cell.addEventListener('mouseenter', () => {
      if (textSpan.scrollWidth > textSpan.clientWidth) {
        deps.tooltip.show(cell, textSpan.textContent ?? '');
      }
    });
    cell.addEventListener('mouseleave', deps.tooltip.dismiss);

    if (opts.columnId) {
      const colId = opts.columnId;

      // Reflect current sort direction so screen readers announce it.
      if (deps.getSortState) {
        cell.setAttribute('aria-sort', deps.getSortState(colId));
      }

      cell.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('bg-resize-handle')) return;
        deps.onHeaderClick(colId);
      });

      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        deps.onHeaderContextMenu(e, colId);
      });

      if (deps.hasFilterPlugin()) {
        const filterBtn = document.createElement('span');
        filterBtn.className = 'bg-header-cell__filter-btn';
        filterBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1.5h8M2.5 4h5M4 6.5h2M5 6.5V9"/></svg>';
        filterBtn.title = 'Filter';
        filterBtn.setAttribute('role', 'button');
        filterBtn.setAttribute('aria-label', `Filter ${textSpan.textContent?.trim() || colId}`);
        filterBtn.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          deps.onFilterButtonClick(e, colId);
        });
        filterBtn.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        cell.appendChild(filterBtn);
      }
    }

    if (opts.resizable) {
      const resizeCol = opts.resizeColIndex ?? opts.colIndex;
      const handle = document.createElement('div');
      handle.className = 'bg-resize-handle';
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        deps.onColumnResize(resizeCol, e);
      });

      if (opts.resizeHandleTop != null && opts.resizeHandleTop < 0) {
        handle.style.top = `${opts.resizeHandleTop}px`;
        cell.style.overflow = 'visible';
      }
      cell.appendChild(handle);
    }

    return cell;
  }

  function appendHeaderCell(cell: HTMLElement, isFrozen: boolean): void {
    if (isFrozen && deps.frozenHeaderOverlay) {
      cell.style.pointerEvents = 'auto';
      deps.frozenHeaderOverlay.appendChild(cell);
    } else {
      deps.headerContainer.appendChild(cell);
    }
  }

  return { render, invalidate };
}
