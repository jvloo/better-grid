// ============================================================================
// Editing Plugin — Cell editing with text input & dropdown support
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition, ColumnDef } from '@better-grid/core';

declare module '@better-grid/core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnDef<TData = unknown> {
    precision?: number;
    /** Minimum allowed numeric value (used for ArrowUp/Down clamping) */
    min?: number;
    /** Maximum allowed numeric value (used for ArrowUp/Down clamping) */
    max?: number;
    /** Placeholder text shown in empty editable cells when inputStyle is enabled */
    placeholder?: string;
    /** Input mask pattern (e.g. 'MM/YY'). Each letter = editable digit section, other chars = fixed. */
    mask?: string;
    /** Persistent suffix adornment (e.g. '%'). Rendered both in display and edit modes.
     *  Can be a static string or a per-row function that returns a suffix or undefined. */
    unit?: string | ((row: TData) => string | undefined);
  }
}

export interface EditingOptions {
  /** How to trigger edit mode. Default: 'dblclick' */
  editTrigger?: 'click' | 'dblclick' | 'type';
  /** When to commit edits. Default: ['enter', 'tab'] */
  commitOn?: ('enter' | 'tab')[];
  /** Cancel on Escape. Default: true */
  cancelOnEscape?: boolean;
  /** Custom labels for boolean dropdown. Default: ['Yes', 'No'] */
  booleanLabels?: [string, string];
  /** Default decimal precision for number/currency cells. Per-column `precision` prop overrides. */
  precision?: number;
  /** Editor rendering mode. 'float' = floating overlay (default), 'inline' = inside cell bounds */
  editorMode?: 'float' | 'inline';
  /**
   * Show editable cells with input-like styling (subtle border, rounded corners).
   * Only applied to cells where `editable` is true/returns true.
   * Default: false
   */
  inputStyle?: boolean;
}

/** Dropdown option for columns with meta.options */
export interface DropdownOption {
  label: string;
  value: unknown;
}

export interface EditingApi {
  startEdit(position: CellPosition, initialValue?: string): void;
  commitEdit(): boolean;
  cancelEdit(): void;
  isEditing(): boolean;
  getEditingCell(): CellPosition | null;
}

const INPUT_CSS = `
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  background: transparent;
  box-sizing: border-box;
`;

// Chevron SVG for dropdown trigger
const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E")`;

export function editing(options?: EditingOptions): GridPlugin<'editing', EditingApi> {
  const config = {
    editTrigger: options?.editTrigger ?? 'dblclick',
    commitOn: options?.commitOn ?? ['enter', 'tab'],
    cancelOnEscape: options?.cancelOnEscape ?? true,
    booleanLabels: options?.booleanLabels ?? (['Yes', 'No'] as [string, string]),
    precision: options?.precision,
    editorMode: options?.editorMode ?? 'float',
    inputStyle: options?.inputStyle ?? false,
  };

  return {
    id: 'editing',

    init(ctx: PluginContext) {
      // ─── Input-style CSS + cellClass wrapping ────────────────────────
      if (config.inputStyle) {
        // Inject CSS once
        if (!document.getElementById('bg-editing-input-style')) {
          const style = document.createElement('style');
          style.id = 'bg-editing-input-style';
          style.textContent = `
            .bg-cell--input-editable {
              display: flex !important;
              align-items: center !important;
              line-height: normal !important;
            }
            .bg-cell--input-editable .bg-input-box {
              pointer-events: none;
              background: var(--bg-input-bg, #F8F8F8);
              border-radius: 4px;
              box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
              height: 30px;
              padding: 0 8px;
              display: flex;
              align-items: center;
              box-sizing: border-box;
              width: 100%;
              font-size: 12px;
            }
            .bg-cell--input-editable .bg-input-box:hover {
              background: var(--bg-input-hover-bg, #F0F0F0);
            }
            .bg-cell--input-editable .bg-input-box--placeholder {
              color: var(--bg-input-placeholder, #98A2B3);
            }
            .bg-cell--input-editable .bg-input-box--has-unit {
              position: relative;
              padding-right: 20px;
            }
            .bg-cell--input-editable .bg-input-box__value {
              display: inline-block;
              text-align: inherit;
            }
            .bg-cell--input-editable .bg-input-box__unit {
              position: absolute;
              right: 8px;
              top: 50%;
              transform: translateY(-50%);
              color: var(--bg-input-unit, #98A2B3);
              pointer-events: none;
              font-size: inherit;
            }
            .bg-cell--editing .bg-input-box__value .bg-cell-editor {
              background: transparent !important;
              box-shadow: none !important;
            }
          `;
          document.head.appendChild(style);
        }

        // Wrap cellClass on editable columns — mark empty cells for flat input styling.
        // Guard against double-wrapping when init runs more than once (HMR, plugin
        // re-registration): skip any column we've already wrapped.
        const columns = ctx.store.getState().columns;
        let changed = false;
        for (const col of columns) {
          if (col.editable === false) continue;
          if (!col.accessorKey && !col.accessorFn) continue;
          if ((col as { __inputStyleWrapped?: boolean }).__inputStyleWrapped) continue;
          (col as { __inputStyleWrapped?: boolean }).__inputStyleWrapped = true;

          const origCellClass = col.cellClass;
          const placeholder = col.placeholder;

          col.cellClass = (value: unknown, row: unknown) => {
            let cls = origCellClass ? origCellClass(value, row) ?? '' : '';
            let isEditable = true;
            if (typeof col.editable === 'function') {
              isEditable = col.editable(row as never, col as never);
            }
            if (isEditable) cls += ' bg-cell--input-editable';
            return cls.trim() || undefined;
          };

          // Wrap cellRenderer to add inner input box
          const origRenderer = col.cellRenderer;
          col.cellRenderer = (container, context) => {
            let isEditable = col.editable !== false;
            if (typeof col.editable === 'function') {
              isEditable = col.editable(context.row as never, col as never);
            }

            if (!isEditable) {
              if (origRenderer) return origRenderer(container, context);
              container.textContent = context.value != null ? String(context.value) : '';
              return;
            }

            // Run original renderer to set styles (bg, font, padding) on the cell.
            // When no column.cellRenderer is set, fall back to valueFormatter or
            // the raw value so editable cells without a custom renderer still
            // produce text for the input box.
            if (origRenderer) {
              origRenderer(container, context);
            } else if (col.valueFormatter) {
              container.textContent = col.valueFormatter(context.value);
            } else if (col.cellType) {
              const typeRenderer = ctx.grid.getCellType(col.cellType);
              if (typeRenderer?.getStringValue) {
                container.textContent = typeRenderer.getStringValue(context);
              } else {
                container.textContent = context.value != null ? String(context.value) : '';
              }
            } else {
              container.textContent = context.value != null ? String(context.value) : '';
            }

            // Capture text set by original renderer, then replace with input box
            const text = container.textContent?.trim() || '';
            container.textContent = '';

            const box = document.createElement('div');
            box.className = 'bg-input-box';
            // Inherit alignment from column
            if (context.column.align === 'center') box.style.justifyContent = 'center';
            else if (context.column.align === 'right') box.style.justifyContent = 'flex-end';
            const isPlaceholderText = Boolean(
              placeholder &&
              text === placeholder &&
              (context.value == null || context.value === ''),
            );
            const unit = typeof col.unit === 'function'
              ? (col.unit as (row: unknown) => string | undefined)(context.row)
              : col.unit;
            if (unit) {
              box.classList.add('bg-input-box--has-unit');
              // Structured value + unit so editing can clear the value without destroying the suffix
              const valueSpan = document.createElement('span');
              valueSpan.className = 'bg-input-box__value';
              if (text) {
                valueSpan.textContent = text;
                if (isPlaceholderText) box.classList.add('bg-input-box--placeholder');
              } else if (placeholder) {
                valueSpan.textContent = placeholder;
                box.classList.add('bg-input-box--placeholder');
              }
              box.appendChild(valueSpan);
              const unitSpan = document.createElement('span');
              unitSpan.className = 'bg-input-box__unit';
              unitSpan.textContent = unit;
              box.appendChild(unitSpan);
            } else if (text) {
              box.textContent = text;
              if (isPlaceholderText) box.classList.add('bg-input-box--placeholder');
            } else if (placeholder) {
              box.textContent = placeholder;
              box.classList.add('bg-input-box--placeholder');
            }
            container.appendChild(box);
          };

          changed = true;
        }

        if (changed) {
          ctx.store.update('columns', () => ({ columns: [...columns] }));
        }
      }
      let editingCell: CellPosition | null = null;
      let activeEditor: HTMLInputElement | null = null;
      let activeFloatBox: HTMLElement | null = null;
      let activeDropdownPanel: HTMLElement | null = null;
      /** Cleanup function for the current editor's outside-click listener */
      let activeOutsideClickCleanup: (() => void) | null = null;
      let activeDropdownOptions: DropdownOption[] | null = null;
      let originalValue: unknown = null;
      let pendingClickEditHandoff: CellPosition | null = null;
      let pendingClickEditHandoffFrame: number | null = null;

      function getGridContainer(): HTMLElement {
        return ctx.grid.getContainer() ?? document.body;
      }

      function getCellElement(pos: CellPosition): HTMLElement | null {
        const selector = `.bg-cell[data-row="${pos.rowIndex}"][data-col="${pos.colIndex}"]`;
        return getGridContainer().querySelector(selector);
      }

      function getCellPositionFromElement(el: Element | null): CellPosition | null {
        if (!(el instanceof HTMLElement)) return null;
        const cell = el.closest('.bg-cell') as HTMLElement | null;
        if (!cell) return null;

        const rowIndex = Number(cell.dataset.row);
        const colIndex = Number(cell.dataset.col);
        if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) return null;

        return { rowIndex, colIndex };
      }

      function isSameCell(a: CellPosition | null, b: CellPosition | null): boolean {
        return !!a && !!b && a.rowIndex === b.rowIndex && a.colIndex === b.colIndex;
      }

      function getCellFromPoint(clientX: number, clientY: number, overlay?: HTMLElement | null): CellPosition | null {
        const previousPointerEvents = overlay?.style.pointerEvents ?? '';
        if (overlay) overlay.style.pointerEvents = 'none';

        const target = document.elementFromPoint(clientX, clientY);

        if (overlay) overlay.style.pointerEvents = previousPointerEvents;
        return getCellPositionFromElement(target);
      }

      function suppressNextClickEdit(cell: CellPosition): void {
        pendingClickEditHandoff = cell;
        if (pendingClickEditHandoffFrame !== null) {
          cancelAnimationFrame(pendingClickEditHandoffFrame);
        }
        pendingClickEditHandoffFrame = requestAnimationFrame(() => {
          pendingClickEditHandoff = null;
          pendingClickEditHandoffFrame = null;
        });
      }

      function getNextClickedCell(
        event: MouseEvent,
        overlay?: HTMLElement | null,
      ): CellPosition | null {
        const directTargetCell = getCellPositionFromElement(event.target as Element | null);
        if (directTargetCell && !isSameCell(editingCell, directTargetCell)) {
          return directTargetCell;
        }

        const pointedCell = getCellFromPoint(event.clientX, event.clientY, overlay);
        if (pointedCell && !isSameCell(editingCell, pointedCell)) {
          return pointedCell;
        }

        return null;
      }

      function getFloatingSyncTargets(anchorEl: HTMLElement): Array<HTMLElement | Window> {
        const targets: Array<HTMLElement | Window> = [window];
        const seen = new Set<HTMLElement | Window>(targets);

        const gridEl = anchorEl.closest('.bg-grid') as HTMLElement | null;
        const gridScroll = gridEl?.querySelector('.bg-grid__scroll') as HTMLElement | null;
        if (gridScroll && !seen.has(gridScroll)) {
          targets.push(gridScroll);
          seen.add(gridScroll);
        }

        let current = anchorEl.parentElement;
        while (current) {
          const style = getComputedStyle(current);
          const overflowValues = [style.overflow, style.overflowX, style.overflowY];
          const isScrollable = overflowValues.some((value) =>
            value === 'auto' || value === 'scroll' || value === 'overlay',
          );

          if (isScrollable && !seen.has(current)) {
            targets.push(current);
            seen.add(current);
          }

          current = current.parentElement;
        }

        return targets;
      }

      function bindFloatingPositionSync(anchorEl: HTMLElement, sync: () => void): () => void {
        let rafId: number | null = null;
        const onSync = () => {
          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            rafId = null;
            sync();
          });
        };

        const targets = getFloatingSyncTargets(anchorEl);
        for (const target of targets) {
          target.addEventListener('scroll', onSync, { passive: true });
        }
        window.addEventListener('resize', onSync);

        return () => {
          if (rafId !== null) cancelAnimationFrame(rafId);
          for (const target of targets) {
            target.removeEventListener('scroll', onSync);
          }
          window.removeEventListener('resize', onSync);
        };
      }

      // -----------------------------------------------------------------------
      // Determine editor type
      // -----------------------------------------------------------------------

      function getDropdownOptions(
        column: ColumnDef,
        value: unknown,
      ): DropdownOption[] | null {
        // column.cellEditor: 'text' forces text input, skips all dropdown logic
        if (column.cellEditor === 'text') return null;

        // Explicit column.options → always dropdown
        if (Array.isArray(column.options) && column.options.length > 0) {
          return column.options.map((opt) =>
            typeof opt === 'object' && opt !== null && 'label' in opt
              ? { label: opt.label, value: opt.value }
              : { label: String(opt), value: opt },
          );
        }

        // Auto-detect: boolean value → Yes/No dropdown
        if (typeof value === 'boolean') {
          return [
            { label: config.booleanLabels[0], value: true },
            { label: config.booleanLabels[1], value: false },
          ];
        }

        return null;
      }

      // -----------------------------------------------------------------------
      // Start editing
      // -----------------------------------------------------------------------

      function startEdit(position: CellPosition, initialValue?: string, clickEvent?: MouseEvent): void {
        if (editingCell) commitEdit();

        const cellEl = getCellElement(position);
        if (!cellEl) return;

        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return;

        // Map visual row index to data index (hierarchy may reorder/filter rows)
        const hs = state.hierarchyState;
        const dataIndex = hs ? (hs.visibleRows[position.rowIndex] ?? position.rowIndex) : position.rowIndex;
        const rowData = state.data[dataIndex];

        // Resolve editable — supports boolean or function(row, column)
        if (column.editable === false) return;
        if (typeof column.editable === 'function') {
          if (!rowData || !column.editable(rowData, column)) return;
        }

        editingCell = position;

        // Get current raw value
        const data = rowData;
        if (column.accessorKey && data) {
          originalValue = (data as Record<string, unknown>)[column.accessorKey];
        } else {
          originalValue = cellEl.textContent;
        }

        // Check if this should be a dropdown or autocomplete
        const isAutocomplete = column.cellEditor === 'autocomplete';
        const dropdownOpts = getDropdownOptions(column, originalValue);

        // Prepare cell for editing
        // If the cell has an input box (inputStyle), use it as the editing anchor
        const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
        // If the input box is structured as value+unit, clear only the value span
        // so the unit suffix stays visible throughout editing.
        const valueSpan = inputBox?.querySelector('.bg-input-box__value') as HTMLElement | null;
        if (valueSpan) {
          valueSpan.textContent = '';
        } else if (inputBox) {
          inputBox.textContent = '';
        } else {
          cellEl.textContent = '';
        }
        cellEl.classList.add('bg-cell--editing');

        // Hide fill handle during editing
        const fillHandle = getGridContainer().querySelector('.bg-fill-handle') as HTMLElement | null;
        if (fillHandle) fillHandle.style.display = 'none';

        if (isAutocomplete) {
          const opts = dropdownOpts ?? [];
          activeEditor = createAutocomplete(cellEl, opts, originalValue, column);
        } else if (dropdownOpts) {
          activeEditor = createDropdown(cellEl, dropdownOpts, originalValue, column);
        } else {
          // Determine display string for the editor
          // Use valueFormatter if available (e.g. date formatting)
          let rawStr = originalValue != null
            ? (column.valueFormatter ? column.valueFormatter(originalValue) : String(originalValue))
            : '';

          if (column.cellType === 'bigint') {
            // BigInt: use String() to preserve full integer precision
            rawStr = originalValue != null ? String(originalValue) : '';
          } else if (column.cellType === 'percent' && typeof originalValue === 'number') {
            // For percent: show user-friendly value (5 instead of 0.05)
            // Avoid floating point: 0.0008 * 100 = 0.08 not 0.07999...
            rawStr = String(parseFloat((originalValue * 100).toPrecision(12)));
          } else if (
            (column.cellType === 'number' || column.cellType === 'currency') &&
            typeof originalValue === 'number'
          ) {
            // Apply precision formatting when starting edit
            const prec = getPrecision(column);
            if (prec != null) {
              rawStr = originalValue.toFixed(prec);
            }
          }

          // Check editor type or auto-detect from cellType
          const isDateEditor = column.cellEditor === 'date' ||
            (!column.cellEditor && column.cellType === 'date');
          const isNumberEditor = column.cellEditor === 'number' ||
            (!column.cellEditor && (column.cellType === 'number' || column.cellType === 'currency'));

          const editValue = initialValue ?? rawStr;

          if (column.cellEditor === 'masked' && column.mask) {
            activeEditor = createMaskedInput(cellEl, rawStr, column.mask, clickEvent);
          } else if (isDateEditor) {
            activeEditor = createDateInput(cellEl, rawStr);
          } else if (config.editorMode === 'inline') {
            activeEditor = createInlineTextInput(cellEl, editValue, initialValue !== undefined, isNumberEditor ? column : undefined);
          } else if (isNumberEditor) {
            activeEditor = createTextInput(cellEl, editValue, initialValue !== undefined, column);
          } else {
            activeEditor = createTextInput(cellEl, editValue, initialValue !== undefined);
          }
        }
      }

      // -----------------------------------------------------------------------
      // Text input editor
      // -----------------------------------------------------------------------

      function createTextInput(
        cellEl: HTMLElement,
        value: string,
        cursorAtEnd: boolean,
        numberColumn?: ColumnDef,
      ): HTMLInputElement {
          // Use input box rect if present (inputStyle mode), otherwise cell rect
          const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
          const anchorEl = inputBox ?? cellEl;
          const cellRect = anchorEl.getBoundingClientRect();
          const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
          const gridRect = gridEl?.getBoundingClientRect();
          const anchorComputed = getComputedStyle(anchorEl);
          const cellPadding = anchorComputed.padding;
          const cellFont = anchorComputed.font;
          const cellTextAlign = anchorComputed.textAlign;
          const cellLetterSpacing = anchorComputed.letterSpacing;
          const maxRightWidth = gridRect ? gridRect.right - cellRect.left : cellRect.width;
          const fullWidth = gridRect?.width ?? cellRect.width;
          const gridLeft = gridRect?.left ?? cellRect.left;

          // Measure span for auto-sizing
          const measureSpan = document.createElement('span');
          measureSpan.style.cssText = `position:fixed;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;font:${cellFont};padding:${cellPadding};`;
          document.body.appendChild(measureSpan);

          // Create float box — resolve CSS variables from grid container (not body)
          const floatBox = document.createElement('div');
          floatBox.className = 'bg-cell-editor-float';
          const gridStyles = getComputedStyle(getGridContainer());
          const edBorderW = parseFloat(gridStyles.getPropertyValue('--bg-editor-border-width').trim() || '2');
          const edBg = gridStyles.getPropertyValue('--bg-editor-bg').trim() || '#fff';
          const edBorder = gridStyles.getPropertyValue('--bg-editor-border').trim() || gridStyles.getPropertyValue('--bg-active-border').trim() || '#1a73e8';
          const edRadius = gridStyles.getPropertyValue('--bg-editor-radius').trim() || '2px';
          const edShadow = gridStyles.getPropertyValue('--bg-editor-shadow').trim() || '0 2px 8px rgba(0,0,0,0.15)';
          floatBox.style.cssText = `
            position: fixed; z-index: 200; box-sizing: border-box;
            top: ${cellRect.top}px; left: ${cellRect.left}px;
            min-width: ${cellRect.width}px; max-width: ${fullWidth}px;
            background: ${edBg};
            border: ${edBorderW}px solid ${edBorder};
            border-radius: ${edRadius};
            box-shadow: ${edShadow};
          `;

          // Use contenteditable div — naturally supports vertical centering
          // (via flexbox) and word-wrap without textarea quirks
          const ed = document.createElement('div');
          ed.className = 'bg-cell-editor';
          ed.contentEditable = 'true';
          ed.textContent = value;
          // Match cell position exactly. Use normal line-height + vertical padding
          // for centering, so text selection highlight doesn't span full cell height.
          const fontSize = parseFloat(anchorComputed.fontSize) || 14;
          const contentLineHeight = Math.round(fontSize * 1.4);
          const editorHeight = cellRect.height - edBorderW * 2;
          const vertPad = Math.max(0, Math.floor((editorHeight - contentLineHeight) / 2));
          const hPad = parseFloat(anchorComputed.paddingLeft) || 12;

          ed.style.cssText = `
            outline:none; margin:0;
            font-family:${anchorComputed.fontFamily}; font-size:${anchorComputed.fontSize};
            font-weight:${anchorComputed.fontWeight}; line-height:${contentLineHeight}px;
            color:inherit; letter-spacing:${cellLetterSpacing};
            background:transparent; box-sizing:border-box;
            padding:${vertPad}px ${hPad}px; text-align:${cellTextAlign};
            min-height:${editorHeight}px;
            max-height:${editorHeight * 4}px;
            overflow:hidden;
            white-space:nowrap;
          `;

          floatBox.appendChild(ed);

          // Number editor: add inputmode hint and restrict input to numeric characters
          if (numberColumn) {
            ed.setAttribute('inputmode', 'decimal');
            const numberPrecision = getPrecision(numberColumn);

            ed.addEventListener('keydown', (e) => {
              // Allow control-modified keys (Ctrl+A/C/V/X etc.)
              if (e.ctrlKey || e.metaKey || e.altKey) return;
              // ArrowUp/Down: increment/decrement value, clamped to min/max
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const text = ed.textContent || '';
                const cur = parseFloat(text) || 0;
                const step = numberPrecision != null ? Math.pow(10, -numberPrecision) : 1;
                const delta = e.key === 'ArrowUp' ? step : -step;
                let next = cur + delta;
                if (numberPrecision != null) {
                  next = parseFloat(next.toFixed(numberPrecision));
                }
                if (numberColumn!.min != null && next < numberColumn!.min) next = numberColumn!.min;
                if (numberColumn!.max != null && next > numberColumn!.max) next = numberColumn!.max;
                ed.textContent = String(next);
                // Select all text after update
                const range = document.createRange();
                range.selectNodeContents(ed);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                return;
              }
              // Allow navigation and control keys
              if (['Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
                   'ArrowLeft', 'ArrowRight',
                   'Home', 'End'].includes(e.key)) return;
              // Allow digits, minus, period
              if (/^[0-9.\-]$/.test(e.key)) {
                const text = ed.textContent || '';
                const selection = window.getSelection();
                const hasSelection = selection && selection.rangeCount > 0 &&
                  !selection.getRangeAt(0).collapsed;

                // Prevent multiple periods
                if (e.key === '.' && text.includes('.') && !hasSelection) {
                  e.preventDefault();
                  return;
                }
                // Prevent minus except at start when no existing minus
                if (e.key === '-') {
                  if (text.includes('-') && !hasSelection) {
                    e.preventDefault();
                    return;
                  }
                  // Only allow minus at cursor position 0
                  if (selection && selection.anchorOffset !== 0) {
                    e.preventDefault();
                    return;
                  }
                }
                // Enforce precision: prevent more decimal places than allowed
                if (numberPrecision != null && /^[0-9]$/.test(e.key) && !hasSelection) {
                  const dotIndex = text.indexOf('.');
                  if (dotIndex !== -1) {
                    const decimals = text.length - dotIndex - 1;
                    const cursorOffset = selection?.anchorOffset ?? text.length;
                    if (cursorOffset > dotIndex && decimals >= numberPrecision) {
                      e.preventDefault();
                      return;
                    }
                  }
                }
                return;
              }
              // Block everything else
              e.preventDefault();
            });
          }

          document.body.appendChild(floatBox);
          activeFloatBox = floatBox;

          function autoSize(): void {
            measureSpan.textContent = ed.textContent || ' ';
            const textWidth = measureSpan.offsetWidth + 16;

            if (textWidth <= maxRightWidth) {
              floatBox.style.left = `${cellRect.left}px`;
              floatBox.style.width = `${Math.max(cellRect.width, textWidth)}px`;
            } else {
              floatBox.style.left = `${gridLeft}px`;
              floatBox.style.width = `${fullWidth}px`;
            }

            // When content overflows, switch to wrap mode
            if (ed.scrollHeight > editorHeight) {
              ed.style.whiteSpace = 'pre-wrap';
              ed.style.wordBreak = 'break-word';
              ed.style.lineHeight = '1.5';
              ed.style.overflow = 'auto';
              ed.style.padding = `${hPad}px`;
            } else {
              ed.style.whiteSpace = 'nowrap';
              ed.style.lineHeight = `${contentLineHeight}px`;
              ed.style.overflow = 'hidden';
              ed.style.padding = `${vertPad}px ${hPad}px`;
            }
          }

          const editRow = cellEl.dataset.row;
          const editCol = cellEl.dataset.col;

          function getAnchorRect(): DOMRect | null {
            const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
            if (!currentCell) return null;
            const box = currentCell.querySelector('.bg-input-box') as HTMLElement | null;
            if (!box) return currentCell.getBoundingClientRect();
            const br = box.getBoundingClientRect();
            // Leave room for a right-side unit adornment (has-unit padding is 20px)
            if (box.classList.contains('bg-input-box--has-unit')) {
              return new DOMRect(br.left, br.top, Math.max(0, br.width - 20), br.height);
            }
            return br;
          }

          function syncPosition(): void {
            // Find current cell element by row/col (may be recycled by virtualization)
            const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
            const gr = gridEl?.getBoundingClientRect();

            if (!currentCell || !gr) {
              // Cell not in DOM (virtualized out) — hide float
              floatBox.style.visibility = 'hidden';
              return;
            }

            const box = currentCell.querySelector('.bg-input-box') as HTMLElement | null;
            let cr: DOMRect;
            if (box) {
              const br = box.getBoundingClientRect();
              cr = box.classList.contains('bg-input-box--has-unit')
                ? new DOMRect(br.left, br.top, Math.max(0, br.width - 20), br.height)
                : br;
            } else {
              cr = currentCell.getBoundingClientRect();
            }
            const headerH = parseFloat(gridEl?.querySelector('.bg-grid__headers')?.getBoundingClientRect().height + '' || '0');
            const cellVisible = cr.bottom > (gr.top + headerH) && cr.top < gr.bottom && cr.right > gr.left && cr.left < gr.right;
            floatBox.style.visibility = cellVisible ? 'visible' : 'hidden';
            if (!cellVisible) return;

            // Update position
            measureSpan.textContent = ed.textContent || ' ';
            const textWidth = measureSpan.offsetWidth + 16;
            const curMaxRight = gr.right - cr.left;
            const curFullWidth = gr.width;
            const curGridLeft = gr.left;

            floatBox.style.top = `${cr.top}px`;
            if (textWidth <= curMaxRight) {
              floatBox.style.left = `${cr.left}px`;
              floatBox.style.width = `${Math.max(cr.width, textWidth)}px`;
            } else {
              floatBox.style.left = `${curGridLeft}px`;
              floatBox.style.width = `${curFullWidth}px`;
            }
          }

          autoSize();
          const unbindPositionSync = bindFloatingPositionSync(cellEl, syncPosition);
          syncPosition();
          ed.addEventListener('input', () => {
            autoSize();
            syncPosition();
          });
          ed.focus();

          // Select all text
          const range = document.createRange();
          range.selectNodeContents(ed);
          if (cursorAtEnd) range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);

          ed.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              cleanupFloat();
            }
            if (e.key === 'Escape') {
              cleanupFloat();
            }
            handleEditorKeydown(e);
          });
          let floatActive = true;

          function cleanupFloat(): void {
            if (!floatActive) return;
            floatActive = false;
            measureSpan.remove();
            floatBox.remove();
            activeFloatBox = null;
            unbindPositionSync();
            document.removeEventListener('mousedown', onOutsideClick, true);
          }

          // Commit on click outside the float box (not blur-based)
          function onOutsideClick(e: MouseEvent): void {
            if (!floatActive) return;
            const nextCell = getNextClickedCell(e, floatBox);
            if (nextCell) {
              suppressNextClickEdit(nextCell);
              cleanupFloat();
              if (editingCell) commitEdit();
              ctx.grid.refresh();
              startEdit(nextCell);
              return;
            }

            if (floatBox.contains(e.target as Node)) {
              const anchorRect = getAnchorRect();
              const insideAnchor = !!anchorRect &&
                e.clientX >= anchorRect.left &&
                e.clientX <= anchorRect.right &&
                e.clientY >= anchorRect.top &&
                e.clientY <= anchorRect.bottom;

              if (insideAnchor) return;
            }
            cleanupFloat();
            if (editingCell) commitEdit();
          }
          // Delay to avoid the dblclick that opened the editor
          setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);
          // Register so cleanupEdit can call it on Escape/Enter/transition
          activeOutsideClickCleanup = cleanupFloat;

          // Shim: make contenteditable act like an input for commit
          const editorShim = {
            get value() { return ed.textContent ?? ''; },
            set value(v: string) { ed.textContent = v; },
            focus() { ed.focus(); },
            removeEventListener: ed.removeEventListener.bind(ed),
            addEventListener: ed.addEventListener.bind(ed),
            setSelectionRange() {},
            dispatchEvent: ed.dispatchEvent.bind(ed),
          } as unknown as HTMLInputElement;
          activeEditor = editorShim;
          return editorShim;
      }

      // -----------------------------------------------------------------------
      // Inline text input editor (renders inside the cell)
      // -----------------------------------------------------------------------

      function createInlineTextInput(
        cellEl: HTMLElement,
        value: string,
        cursorAtEnd: boolean,
        numberColumn?: ColumnDef,
      ): HTMLInputElement {
        // Capture computed styles BEFORE clearing cell content
        const computed = getComputedStyle(cellEl);
        const cellFont = computed.font;
        const cellTextAlign = computed.textAlign;
        const cellLetterSpacing = computed.letterSpacing;

        // Create a simple input inside the cell
        // The cell already has padding, so the input uses padding: 0 to avoid double padding
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor bg-cell-editor--inline';
        input.value = value;
        input.style.cssText = `
          width: 100%; height: 100%;
          border: none; outline: none;
          font: ${cellFont}; padding: 0;
          text-align: ${cellTextAlign}; letter-spacing: ${cellLetterSpacing};
          margin: 0; box-sizing: border-box;
          background: transparent; color: inherit;
        `;

        // Number filtering (same as float mode)
        if (numberColumn) {
          input.inputMode = 'decimal';
          const numberPrecision = getPrecision(numberColumn);

          input.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            // ArrowUp/Down: increment/decrement value, clamped to min/max
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const cur = parseFloat(input.value) || 0;
              const step = numberPrecision != null ? Math.pow(10, -numberPrecision) : 1;
              const delta = e.key === 'ArrowUp' ? step : -step;
              let next = cur + delta;
              if (numberPrecision != null) {
                next = parseFloat(next.toFixed(numberPrecision));
              }
              if (numberColumn!.min != null && next < numberColumn!.min) next = numberColumn!.min;
              if (numberColumn!.max != null && next > numberColumn!.max) next = numberColumn!.max;
              input.value = String(next);
              input.select();
              return;
            }
            if (['Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
                 'ArrowLeft', 'ArrowRight',
                 'Home', 'End'].includes(e.key)) return;
            if (/^[0-9.\-]$/.test(e.key)) {
              const text = input.value;
              const selStart = input.selectionStart ?? text.length;
              const selEnd = input.selectionEnd ?? text.length;
              const hasSelection = selStart !== selEnd;

              if (e.key === '.' && text.includes('.') && !hasSelection) { e.preventDefault(); return; }
              if (e.key === '-') {
                if (text.includes('-') && !hasSelection) { e.preventDefault(); return; }
                if (selStart !== 0) { e.preventDefault(); return; }
              }
              if (numberPrecision != null && /^[0-9]$/.test(e.key) && !hasSelection) {
                const dotIndex = text.indexOf('.');
                if (dotIndex !== -1 && selStart > dotIndex && text.length - dotIndex - 1 >= numberPrecision) {
                  e.preventDefault(); return;
                }
              }
              return;
            }
            e.preventDefault();
          });
        }

        // If the cell has a structured value/unit input-box, anchor the editor
        // inside the value span so the unit suffix stays visible to its right.
        const valueAnchor = cellEl.querySelector('.bg-input-box__value') as HTMLElement | null;
        if (valueAnchor) {
          input.style.width = 'auto';
          input.style.minWidth = '40px';
          valueAnchor.appendChild(input);
        } else {
          cellEl.appendChild(input);
        }
        input.focus();

        if (cursorAtEnd) {
          input.setSelectionRange(value.length, value.length);
        } else {
          input.select();
        }

        // Keyboard handling
        input.addEventListener('keydown', (e) => {
          handleEditorKeydown(e);
        });

        // Commit on click outside the cell
        function onOutsideClick(e: MouseEvent): void {
          if (cellEl.contains(e.target as Node)) return;
          document.removeEventListener('mousedown', onOutsideClick, true);
          if (editingCell) {
            commitEdit();
          }
          // Don't clearSelection — let handlePointerDown select the clicked cell
        }
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);

        return input;
      }

      // -----------------------------------------------------------------------
      // Date input editor
      // -----------------------------------------------------------------------

      // -----------------------------------------------------------------------
      // Masked input editor (e.g. MM/YY, DD/MM/YYYY, HH:mm:ss)
      // -----------------------------------------------------------------------

      // Section validation rules keyed by label (case-sensitive: MM=month, mm=minutes).
      // autoPadFrom: first digit at or above this triggers "0X" auto-pad.
      function sectionValidation(label: string, _secLen: number): { min: number; max: number; autoPadFrom: number } | null {
        switch (label) {
          case 'MM': return { min: 1, max: 12, autoPadFrom: 2 };
          case 'DD': return { min: 1, max: 31, autoPadFrom: 4 };
          case 'HH': return { min: 0, max: 23, autoPadFrom: 3 };
          case 'mm': case 'ss': case 'SS': return { min: 0, max: 59, autoPadFrom: 6 };
          default: return null;
        }
      }

      function createMaskedInput(
        cellEl: HTMLElement,
        value: string,
        mask: string,
        clickEvent?: MouseEvent,
      ): HTMLInputElement {
        const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
        const anchorEl = inputBox ?? cellEl;
        const cellRect = anchorEl.getBoundingClientRect();
        const gridStyles = getComputedStyle(getGridContainer());
        const edBorderW = parseFloat(gridStyles.getPropertyValue('--bg-editor-border-width').trim() || '2');
        const edBg = gridStyles.getPropertyValue('--bg-editor-bg').trim() || '#fff';
        const edBorder = gridStyles.getPropertyValue('--bg-editor-border').trim() || gridStyles.getPropertyValue('--bg-active-border').trim() || '#1a73e8';
        const edRadius = gridStyles.getPropertyValue('--bg-editor-radius').trim() || '2px';
        const edShadow = gridStyles.getPropertyValue('--bg-editor-shadow').trim() || '0 2px 8px rgba(0,0,0,0.15)';

        const sectionLengths: number[] = [];
        const sectionLabels: string[] = [];
        const separators: { pos: number; char: string }[] = [];
        let currentSectionLength = 0;
        let currentSectionLabel = '';
        for (const ch of mask) {
          if (/[A-Za-z]/.test(ch)) {
            currentSectionLength += 1;
            currentSectionLabel += ch;
          } else {
            if (currentSectionLength > 0) {
              sectionLengths.push(currentSectionLength);
              sectionLabels.push(currentSectionLabel);
              currentSectionLength = 0;
              currentSectionLabel = '';
            }
            separators.push({ pos: sectionLengths.length, char: ch });
          }
        }
        if (currentSectionLength > 0) {
          sectionLengths.push(currentSectionLength);
          sectionLabels.push(currentSectionLabel);
        }

        // ── Section-based state ──────────────────────────────────────────
        // Each section independently holds its digits or is empty (shows label).
        // e.g. sectionValues = ['12', '25'] for "12/25", or ['', '25'] for "MM/25"
        const initialDigits = value.replace(/\D/g, '');
        const sectionValues: string[] = [];
        let digitOffset = 0;
        for (let i = 0; i < sectionLengths.length; i += 1) {
          const len = sectionLengths[i]!;
          const part = initialDigits.slice(digitOffset, digitOffset + len);
          sectionValues.push(part.length === len ? part : '');
          digitOffset += len;
        }
        let activeSectionIdx = 0;

        // Build the display string: filled sections show digits, empty show label
        function buildDisplayValue(): string {
          let result = '';
          for (let i = 0; i < sectionLengths.length; i += 1) {
            // Insert separators that come before this section
            for (const sep of separators) {
              if (sep.pos === i) result += sep.char;
            }
            result += sectionValues[i] || sectionLabels[i] || ''.padEnd(sectionLengths[i]!, '_');
          }
          // Trailing separators
          for (const sep of separators) {
            if (sep.pos === sectionLengths.length) result += sep.char;
          }
          return result;
        }

        // Get character range [start, end) of a section in the display string
        function getSectionRange(sectionIndex: number): { start: number; end: number } {
          let pos = 0;
          for (let i = 0; i < sectionLengths.length; i += 1) {
            for (const sep of separators) {
              if (sep.pos === i) pos += sep.char.length;
            }
            const len = sectionValues[i]
              ? sectionValues[i]!.length
              : (sectionLabels[i]?.length ?? sectionLengths[i]!);
            if (i === sectionIndex) return { start: pos, end: pos + len };
            pos += len;
          }
          return { start: 0, end: 0 };
        }

        function getSectionAtCursor(cursorPos: number): number {
          for (let i = sectionLengths.length - 1; i >= 0; i -= 1) {
            const range = getSectionRange(i);
            if (cursorPos >= range.start) return i;
          }
          return 0;
        }

        function syncInputDisplay(): void {
          input.value = buildDisplayValue();
          const range = getSectionRange(activeSectionIdx);
          input.setSelectionRange(range.start, range.end);
          syncDisplayLayer();
        }

        // Get the committed value (only digits from filled sections, joined by separator)
        function getCommitValue(): string {
          const allFilled = sectionValues.every((v) => v !== '');
          if (!allFilled) return '';
          return sectionValues.join('/');
        }

        // Capture cell's computed font so editor matches cell rendering
        const anchorComputed = getComputedStyle(anchorEl);

        // Create float box
        const floatBox = document.createElement('div');
        floatBox.className = 'bg-cell-editor-float';
        floatBox.style.cssText = `
          position: fixed; z-index: 200; box-sizing: border-box;
          top: ${cellRect.top}px; left: ${cellRect.left}px;
          min-width: ${cellRect.width}px;
          background: ${edBg};
          border: ${edBorderW}px solid ${edBorder};
          border-radius: ${edRadius};
          box-shadow: ${edShadow};
          height: ${cellRect.height}px;
          font-size: ${anchorComputed.fontSize};
          font-family: ${anchorComputed.fontFamily};
        `;

        // Display layer: spans with per-section coloring (digits = normal, labels = grey)
        const displayLayer = document.createElement('div');
        displayLayer.style.cssText = `
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center;
          font-family: ${anchorComputed.fontFamily};
          font-size: ${anchorComputed.fontSize};
          font-weight: ${anchorComputed.fontWeight};
          letter-spacing: ${anchorComputed.letterSpacing};
          padding: ${anchorComputed.padding};
          pointer-events: none;
          white-space: nowrap;
        `;

        const placeholderColor = getComputedStyle(cellEl).color;

        function syncDisplayLayer(): void {
          displayLayer.innerHTML = '';
          for (let i = 0; i < sectionLengths.length; i += 1) {
            // Separators before this section
            for (const sep of separators) {
              if (sep.pos === i) {
                const sepSpan = document.createElement('span');
                sepSpan.textContent = sep.char;
                sepSpan.style.color = placeholderColor;
                displayLayer.appendChild(sepSpan);
              }
            }
            const span = document.createElement('span');
            const filled = sectionValues[i];
            span.textContent = filled || sectionLabels[i] || '';
            span.style.color = filled ? 'inherit' : placeholderColor;
            displayLayer.appendChild(span);
          }
          // Trailing separators
          for (const sep of separators) {
            if (sep.pos === sectionLengths.length) {
              const sepSpan = document.createElement('span');
              sepSpan.textContent = sep.char;
              sepSpan.style.color = placeholderColor;
              displayLayer.appendChild(sepSpan);
            }
          }
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor bg-cell-editor--masked';
        input.value = buildDisplayValue();
        input.style.cssText = `
          position: relative; z-index: 1;
          width: 100%;
          height: ${cellRect.height - edBorderW * 2}px;
          border: none;
          outline: none;
          background: transparent;
          box-sizing: border-box;
          font-family: ${anchorComputed.fontFamily};
          font-size: ${anchorComputed.fontSize};
          font-weight: ${anchorComputed.fontWeight};
          letter-spacing: ${anchorComputed.letterSpacing};
          color: transparent;
          text-align: ${anchorComputed.textAlign};
          padding: ${anchorComputed.padding};
          caret-color: transparent;
        `;

        // All input goes through keydown — prevent browser from mutating the value
        input.addEventListener('beforeinput', (e) => { e.preventDefault(); });

        // Click on MM or YY → select that section
        input.addEventListener('mouseup', () => {
          activeSectionIdx = getSectionAtCursor(input.selectionStart ?? 0);
          const range = getSectionRange(activeSectionIdx);
          input.setSelectionRange(range.start, range.end);
        });

        input.addEventListener('keydown', (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
            return;
          }

          // Digit: type into active section
          if (/^\d$/.test(e.key)) {
            e.preventDefault();
            const secLen = sectionLengths[activeSectionIdx]!;
            const cur = sectionValues[activeSectionIdx] || '';
            const label = sectionLabels[activeSectionIdx] ?? '';
            const sv = sectionValidation(label, secLen);

            // If section is full, replace it (start fresh)
            let next = cur.length >= secLen ? e.key : cur + e.key;

            // Auto-pad: first digit already exceeds max tens → "0X" and advance
            if (sv && next.length === 1 && Number(next) >= sv.autoPadFrom) {
              next = `0${next}`;
            }
            // Validation: if completed value is out of range, auto-pad first
            // digit and spill the second into the next section
            if (sv && next.length >= 2) {
              const num = Number(next.slice(0, 2));
              if (num < sv.min || num > sv.max) {
                const spillDigit = next[1]!;
                sectionValues[activeSectionIdx] = `0${next[0]}`;
                if (activeSectionIdx < sectionLengths.length - 1) {
                  activeSectionIdx += 1;
                  sectionValues[activeSectionIdx] = spillDigit;
                }
                syncInputDisplay();
                return;
              }
            }

            sectionValues[activeSectionIdx] = next.slice(0, secLen);

            // Auto-advance to next section when current is full
            if (sectionValues[activeSectionIdx]!.length >= secLen && activeSectionIdx < sectionLengths.length - 1) {
              activeSectionIdx += 1;
            }

            syncInputDisplay();
            return;
          }

          // Backspace: clear active section, then move to previous
          if (e.key === 'Backspace') {
            e.preventDefault();
            if (sectionValues[activeSectionIdx]) {
              // Section has a value → clear it (show label placeholder)
              sectionValues[activeSectionIdx] = '';
            } else if (activeSectionIdx > 0) {
              // Section already empty → move to previous and clear it
              activeSectionIdx -= 1;
              sectionValues[activeSectionIdx] = '';
            }
            syncInputDisplay();
            return;
          }

          // Delete: clear active section
          if (e.key === 'Delete') {
            e.preventDefault();
            sectionValues[activeSectionIdx] = '';
            syncInputDisplay();
            return;
          }

          // ArrowLeft/Right: navigate between sections
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (activeSectionIdx > 0) activeSectionIdx -= 1;
            const range = getSectionRange(activeSectionIdx);
            input.setSelectionRange(range.start, range.end);
            return;
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (activeSectionIdx < sectionLengths.length - 1) activeSectionIdx += 1;
            const range = getSectionRange(activeSectionIdx);
            input.setSelectionRange(range.start, range.end);
            return;
          }

          // ArrowUp/Down: increment/decrement section value
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const secLen = sectionLengths[activeSectionIdx]!;
            const label = sectionLabels[activeSectionIdx] ?? '';
            const sv = sectionValidation(label, secLen);
            const cur = parseInt(sectionValues[activeSectionIdx] || '0', 10);
            const delta = e.key === 'ArrowUp' ? 1 : -1;
            let next = cur + delta;
            if (sv) {
              if (next > sv.max) next = sv.min;
              if (next < sv.min) next = sv.max;
            } else {
              const ceiling = Math.pow(10, secLen) - 1;
              if (next > ceiling) next = 0;
              if (next < 0) next = ceiling;
            }
            sectionValues[activeSectionIdx] = String(next).padStart(secLen, '0');
            syncInputDisplay();
            return;
          }

          e.preventDefault();
        });

        syncDisplayLayer();
        floatBox.appendChild(displayLayer);
        floatBox.appendChild(input);

        document.body.appendChild(floatBox);
        activeFloatBox = floatBox;

        const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
        const editRow = cellEl.dataset.row;
        const editCol = cellEl.dataset.col;

        function getAnchorRect(): DOMRect | null {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          if (!currentCell) return null;
          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          return anchor.getBoundingClientRect();
        }

        function syncMaskedPosition(): void {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          const gr = gridEl?.getBoundingClientRect();
          if (!currentCell || !gr) { floatBox.style.visibility = 'hidden'; return; }
          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          const cr = anchor.getBoundingClientRect();
          const headerH = parseFloat(gridEl?.querySelector('.bg-grid__headers')?.getBoundingClientRect().height + '' || '0');
          const cellVisible = cr.bottom > (gr.top + headerH) && cr.top < gr.bottom && cr.right > gr.left && cr.left < gr.right;
          floatBox.style.visibility = cellVisible ? 'visible' : 'hidden';
          if (cellVisible) {
            floatBox.style.top = `${cr.top}px`;
            floatBox.style.left = `${cr.left}px`;
            floatBox.style.width = `${cr.width}px`;
          }
        }
        const unbindPositionSync = bindFloatingPositionSync(cellEl, syncMaskedPosition);
        syncMaskedPosition();

        requestAnimationFrame(() => {
          input.focus();
          // Determine which section was clicked based on mouse position
          let initialSection = 0;
          if (clickEvent && sectionLengths.length > 1) {
            // Measure where each section sits by using a temporary canvas context
            const ctx2d = document.createElement('canvas').getContext('2d');
            if (ctx2d) {
              ctx2d.font = `${anchorComputed.fontWeight} ${anchorComputed.fontSize} ${anchorComputed.fontFamily}`;
              const display = buildDisplayValue();
              const sepRange = getSectionRange(0);
              // Text up to end of first section + separator = boundary between MM and YY
              const boundaryText = display.slice(0, sepRange.end + 1);
              const boundaryWidth = ctx2d.measureText(boundaryText).width;
              // Compare click position relative to cell's text start
              const paddingLeft = parseFloat(anchorComputed.paddingLeft) || 0;
              const clickOffset = clickEvent.clientX - cellRect.left - paddingLeft;
              if (clickOffset > boundaryWidth) {
                initialSection = 1;
              }
            }
          }
          activeSectionIdx = initialSection;
          const range = getSectionRange(initialSection);
          input.setSelectionRange(range.start, range.end);
        });

        let maskedActive = true;
        function cleanupMasked(): void {
          if (!maskedActive) return;
          maskedActive = false;
          document.removeEventListener('mousedown', onMaskedOutsideClick, true);
          unbindPositionSync();
          activeOutsideClickCleanup = null;
        }
        function onMaskedOutsideClick(e: MouseEvent): void {
          if (!maskedActive) return;
          const nextCell = getNextClickedCell(e, floatBox);
          if (nextCell) {
            suppressNextClickEdit(nextCell);
            cleanupMasked();
            if (editingCell) commitEdit();
            ctx.grid.refresh();
            startEdit(nextCell);
            return;
          }

          if (floatBox.contains(e.target as Node)) {
            const anchorRect = getAnchorRect();
            const insideAnchor = !!anchorRect &&
              e.clientX >= anchorRect.left &&
              e.clientX <= anchorRect.right &&
              e.clientY >= anchorRect.top &&
              e.clientY <= anchorRect.bottom;

            if (insideAnchor) return;
          }
          cleanupMasked();
          if (editingCell) commitEdit();
        }
        setTimeout(() => document.addEventListener('mousedown', onMaskedOutsideClick, true), 0);
        activeOutsideClickCleanup = cleanupMasked;

        // Return a shim whose .value returns the commit value (digits only, joined)
        const shim = document.createElement('input');
        Object.defineProperty(shim, 'value', {
          get: () => getCommitValue(),
        });
        return shim;
      }

      // -----------------------------------------------------------------------
      // Date input editor
      // -----------------------------------------------------------------------

      function createDateInput(
        cellEl: HTMLElement,
        value: string,
      ): HTMLInputElement {
        const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
        const anchorEl = inputBox ?? cellEl;
        const cellRect = anchorEl.getBoundingClientRect();
        const cellFont = getComputedStyle(anchorEl).font;
        const cellPadding = getComputedStyle(anchorEl).padding;

        // Create floating container (same pattern as text editor)
        const floatBox = document.createElement('div');
        floatBox.className = 'bg-cell-editor-float';
        const borderW = 2;
        floatBox.style.cssText = `
          position: fixed; z-index: 200; box-sizing: border-box;
          top: ${cellRect.top}px; left: ${cellRect.left}px;
          min-width: ${cellRect.width}px;
          background: #fff; border: ${borderW}px solid var(--bg-active-border, #1a73e8);
          border-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        `;

        // Native date input
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'bg-cell-editor bg-cell-editor--date';
        input.style.cssText = `
          width: 100%; border: none; outline: none;
          font: ${cellFont}; padding: ${cellPadding};
          min-height: ${cellRect.height - borderW * 2}px;
          box-sizing: border-box; background: transparent;
          color: inherit;
        `;

        // Convert the value to YYYY-MM-DD format for the input
        if (value) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            input.value = d.toISOString().split('T')[0] ?? '';
          } else {
            input.value = value; // Try as-is (might already be YYYY-MM-DD)
          }
        }

        floatBox.appendChild(input);
        document.body.appendChild(floatBox);
        activeFloatBox = floatBox;

        const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
        const editRow = cellEl.dataset.row;
        const editCol = cellEl.dataset.col;

        function getAnchorRect(): DOMRect | null {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          if (!currentCell) return null;
          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          return anchor.getBoundingClientRect();
        }

        function syncDatePosition(): void {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          const gr = gridEl?.getBoundingClientRect();
          if (!currentCell || !gr) {
            floatBox.style.visibility = 'hidden';
            return;
          }

          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          const cr = anchor.getBoundingClientRect();
          const headerH = parseFloat(gridEl?.querySelector('.bg-grid__headers')?.getBoundingClientRect().height + '' || '0');
          const cellVisible = cr.bottom > (gr.top + headerH) && cr.top < gr.bottom && cr.right > gr.left && cr.left < gr.right;
          floatBox.style.visibility = cellVisible ? 'visible' : 'hidden';
          if (cellVisible) {
            floatBox.style.top = `${cr.top}px`;
            floatBox.style.left = `${cr.left}px`;
            floatBox.style.width = `${cr.width}px`;
          }
        }

        const unbindPositionSync = bindFloatingPositionSync(cellEl, syncDatePosition);
        syncDatePosition();
        input.focus();

        // Keyboard handling
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
          } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
          }
        });

        // Click outside to commit
        function onOutsideClick(ev: MouseEvent): void {
          const nextCell = getNextClickedCell(ev, floatBox);
          if (nextCell) {
            suppressNextClickEdit(nextCell);
            cleanup();
            if (editingCell) commitEdit();
            ctx.grid.refresh();
            startEdit(nextCell);
            return;
          }

          if (floatBox.contains(ev.target as Node)) {
            const anchorRect = getAnchorRect();
            const insideAnchor = !!anchorRect &&
              ev.clientX >= anchorRect.left &&
              ev.clientX <= anchorRect.right &&
              ev.clientY >= anchorRect.top &&
              ev.clientY <= anchorRect.bottom;

            if (insideAnchor) return;
          }
          cleanup();
          if (editingCell) commitEdit();
        }
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);

        let active = true;
        function cleanup(): void {
          if (!active) return;
          active = false;
          unbindPositionSync();
          floatBox.remove();
          activeFloatBox = null;
          document.removeEventListener('mousedown', onOutsideClick, true);
          activeOutsideClickCleanup = null;
        }

        activeOutsideClickCleanup = cleanup;

        // Return a shim that acts like the text editor
        const editorShim = {
          get value() { return input.value; }, // Returns YYYY-MM-DD
          set value(v: string) { input.value = v; },
          focus() { input.focus(); },
          removeEventListener: input.removeEventListener.bind(input),
          addEventListener: input.addEventListener.bind(input),
          setSelectionRange() {},
          dispatchEvent: input.dispatchEvent.bind(input),
        } as unknown as HTMLInputElement;

        return editorShim;
      }

      // -----------------------------------------------------------------------
      // Dropdown editor
      // -----------------------------------------------------------------------

      function createDropdown(
        cellEl: HTMLElement,
        opts: DropdownOption[],
        currentValue: unknown,
        column?: ColumnDef,
      ): HTMLInputElement {
        activeDropdownOptions = opts;

        // Hidden input for focus and keyboard handling
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor bg-cell-editor--dropdown-trigger';
        input.readOnly = true;

        const currentOpt = opts.find((o) => o.value === currentValue || String(o.value) === String(currentValue));
        input.value = currentOpt?.label ?? String(currentValue ?? '');

        // Badge columns: show badge pill in cell during edit mode
        const isBadge = column?.cellType === 'badge';
        const badgeOptions = isBadge ? column?.options as Array<{ label: string; value: unknown; color?: string; bg?: string }> | undefined : undefined;
        const badgeMatch = badgeOptions?.find(b => b.value === currentValue || String(b.value) === String(currentValue));

        if (badgeMatch) {
          // Render badge + chevron as the trigger instead of plain input
          input.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none;';
          const badgeEl = document.createElement('span');
          badgeEl.className = 'bg-cell-editor--badge-trigger';
          badgeEl.style.cssText = `
            display:inline-flex;align-items:center;gap:6px;cursor:pointer;width:100%;height:100%;line-height:normal;
          `;
          const pill = document.createElement('span');
          pill.textContent = badgeMatch.label ?? String(currentValue);
          pill.style.cssText = `display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;color:${badgeMatch.color ?? '#666'};background:${badgeMatch.bg ?? '#f5f5f5'};`;
          const chevron = document.createElement('span');
          chevron.innerHTML = `<svg width="8" height="5" style="opacity:0.5"><path d="M0 0l4 5 4-5z" fill="currentColor"/></svg>`;
          chevron.style.cssText = 'margin-left:auto;display:inline-flex;align-items:center;';
          badgeEl.appendChild(pill);
          badgeEl.appendChild(chevron);
          badgeEl.addEventListener('mousedown', () => input.focus());
          cellEl.appendChild(badgeEl);
          cellEl.appendChild(input);
        } else {
          input.style.cssText = INPUT_CSS + `
            cursor: pointer;
            background: transparent;
            background-image: ${CHEVRON_SVG};
            background-repeat: no-repeat;
            background-position: right 6px center;
            padding-right: 20px;
            padding-left: ${(getComputedStyle(cellEl).paddingLeft) || '12px'};
            text-align: ${getComputedStyle(cellEl).textAlign};
          `;
          cellEl.appendChild(input);
        }

        input.focus();

        // Create the floating dropdown panel
        const rect = cellEl.getBoundingClientRect();
        const cellFont = getComputedStyle(cellEl).font;
        const panel = document.createElement('div');
        panel.className = 'bg-dropdown-panel';
        panel.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.bottom}px;
          min-width: ${rect.width}px;
          z-index: 100;
          background: var(--bg-dropdown-bg, #fff);
          border: 1px solid var(--bg-dropdown-border, #d0d0d0);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 4px 0;
          max-height: 200px;
          overflow-y: auto;
          font: ${cellFont}; line-height: normal;
        `;

        let selectedIndex = opts.findIndex((o) => o.value === currentValue || String(o.value) === String(currentValue));

        for (let i = 0; i < opts.length; i++) {
          const opt = opts[i]!;
          const item = document.createElement('div');
          item.className = 'bg-dropdown-item' + (i === selectedIndex ? ' bg-dropdown-item--selected' : '');
          item.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            user-select: none;
            font: inherit;
            ${i === selectedIndex ? 'background: var(--bg-dropdown-selected-bg, #e8f0fe); font-weight: 500;' : ''}
          `;

          // Render badge pill inside dropdown item if column is badge type
          const badgeMatch = badgeOptions?.find(b => b.value === opt.value || String(b.value) === String(opt.value));
          if (badgeMatch) {
            const badge = document.createElement('span');
            badge.textContent = opt.label;
            badge.style.cssText = `display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;color:${badgeMatch.color ?? '#666'};background:${badgeMatch.bg ?? '#f5f5f5'};`;
            item.appendChild(badge);
          } else {
            item.textContent = opt.label;
          }
          item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--bg-dropdown-hover-bg, #f0f0f0)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = i === selectedIndex ? 'var(--bg-dropdown-selected-bg, #e8f0fe)' : '';
          });
          item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur from firing
            selectedIndex = i;
            input.value = opt.label;
            commitDropdown(i);
          });
          panel.appendChild(item);
        }

        document.body.appendChild(panel);
        activeDropdownPanel = panel;

        // Keyboard navigation in dropdown
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, opts.length - 1);
            highlightDropdownItem(panel, selectedIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            highlightDropdownItem(panel, selectedIndex);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commitDropdown(selectedIndex);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            commitDropdown(selectedIndex);
          }
        });

        input.addEventListener('blur', () => {
          setTimeout(() => {
            if (editingCell && activeDropdownPanel) {
              commitDropdown(selectedIndex);
            }
          }, 100);
        });

        return input;
      }

      function commitDropdown(selectedIndex: number): void {
        if (!activeDropdownOptions || !editingCell) return;
        const opt = activeDropdownOptions[selectedIndex];
        if (!opt) { cancelEdit(); return; }

        const position = editingCell;
        const prevValue = originalValue;
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];

        if (column?.accessorKey && opt.value !== prevValue) {
          ctx.grid.updateCell(position.rowIndex, column.id, opt.value);
        }

        cleanupEdit();
      }

      function highlightDropdownItem(panel: HTMLElement, index: number): void {
        const items = panel.querySelectorAll('.bg-dropdown-item');
        items.forEach((item, i) => {
          const el = item as HTMLElement;
          if (i === index) {
            el.classList.add('bg-dropdown-item--selected');
            el.style.background = 'var(--bg-dropdown-selected-bg, #e8f0fe)';
            el.style.fontWeight = '500';
            el.scrollIntoView({ block: 'nearest' });
          } else {
            el.classList.remove('bg-dropdown-item--selected');
            el.style.background = '';
            el.style.fontWeight = '';
          }
        });
      }

      // -----------------------------------------------------------------------
      // Autocomplete editor
      // -----------------------------------------------------------------------

      function createAutocomplete(
        cellEl: HTMLElement,
        opts: DropdownOption[],
        currentValue: unknown,
        column: ColumnDef,
      ): HTMLInputElement {
        activeDropdownOptions = opts;

        const allowCreate = !!(column.meta as Record<string, unknown> | undefined)?.allowCreate;
        const onCreateOption = (column.meta as Record<string, unknown> | undefined)?.onCreateOption as
          | ((value: string) => void)
          | undefined;

        // Cell metrics
        const rect = cellEl.getBoundingClientRect();
        const cellFont = getComputedStyle(cellEl).font;

        // Create panel
        const panel = document.createElement('div');
        panel.className = 'bg-dropdown-panel';
        panel.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          min-width: ${rect.width}px;
          z-index: 200;
          background: var(--bg-dropdown-bg, #fff);
          border: 1px solid var(--bg-dropdown-border, #d0d0d0);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font: ${cellFont}; line-height: normal;
        `;

        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        // Start empty so all options are visible; current value is highlighted in the list
        searchInput.value = '';
        searchInput.style.cssText = `
          border: none;
          border-bottom: 1px solid #e0e0e0;
          padding: 8px 12px;
          width: 100%;
          outline: none;
          font: inherit;
          box-sizing: border-box;
        `;
        panel.appendChild(searchInput);

        // Options list container
        const listEl = document.createElement('div');
        listEl.style.cssText = `
          max-height: 200px;
          overflow-y: auto;
          padding: 4px 0;
        `;
        panel.appendChild(listEl);

        let highlightedIndex = -1;
        let filteredOpts: DropdownOption[] = [];
        let showCreateItem = false;
        let selectedValue: unknown = currentValue;

        function renderOptions(): void {
          const query = searchInput.value.toLowerCase().trim();
          filteredOpts = query
            ? opts.filter((o) => o.label.toLowerCase().includes(query))
            : [...opts];

          // Determine if "create new" should show
          const exactMatch = opts.some((o) => o.label.toLowerCase() === query);
          showCreateItem = allowCreate && query.length > 0 && !exactMatch;

          listEl.innerHTML = '';
          highlightedIndex = -1;

          for (let i = 0; i < filteredOpts.length; i++) {
            const opt = filteredOpts[i]!;
            const isSelected = opt.value === currentValue || String(opt.value) === String(currentValue);
            const item = document.createElement('div');
            item.className = 'bg-dropdown-item' + (isSelected ? ' bg-dropdown-item--selected' : '');
            item.textContent = opt.label;
            item.style.cssText = `
              padding: 6px 12px;
              cursor: pointer;
              user-select: none;
              font: inherit;
              ${isSelected ? 'background: var(--bg-dropdown-selected-bg, #e8f0fe); font-weight: 500;' : ''}
            `;
            item.addEventListener('mouseenter', () => {
              highlightedIndex = i;
              highlightAutocompleteItem(listEl, highlightedIndex);
            });
            item.addEventListener('mousedown', (e) => {
              e.preventDefault();
              selectOption(opt.value);
            });
            listEl.appendChild(item);
          }

          // "Create new" item
          if (showCreateItem) {
            const createItem = document.createElement('div');
            createItem.className = 'bg-dropdown-item bg-dropdown-item--create';
            createItem.textContent = `+ Create "${searchInput.value}"`;
            createItem.style.cssText = `
              padding: 6px 12px;
              cursor: pointer;
              user-select: none;
              font: inherit;
              color: var(--bg-active-border, #1a73e8);
              border-top: 1px solid #e0e0e0;
            `;
            createItem.addEventListener('mouseenter', () => {
              highlightedIndex = filteredOpts.length;
              highlightAutocompleteItem(listEl, highlightedIndex);
            });
            createItem.addEventListener('mousedown', (e) => {
              e.preventDefault();
              createNewOption();
            });
            listEl.appendChild(createItem);
          }
        }

        function totalCount(): number {
          return filteredOpts.length + (showCreateItem ? 1 : 0);
        }

        function selectOption(value: unknown): void {
          selectedValue = value;
          commitAutocomplete(value);
        }

        function createNewOption(): void {
          const text = searchInput.value;
          selectedValue = text;
          if (typeof onCreateOption === 'function') {
            onCreateOption(text);
          }
          commitAutocomplete(text);
        }

        function commitAutocomplete(value: unknown): void {
          if (!editingCell) return;
          const position = editingCell;
          const prevValue = originalValue;
          const state = ctx.grid.getState();
          const col = state.columns[position.colIndex];

          if (col?.accessorKey && value !== prevValue) {
            ctx.grid.updateCell(position.rowIndex, col.id, value);
          }

          cleanup();
          cleanupEdit();
        }

        function highlightAutocompleteItem(
          container: HTMLElement,
          index: number,
        ): void {
          const items = container.querySelectorAll('.bg-dropdown-item');
          items.forEach((item, i) => {
            const el = item as HTMLElement;
            if (i === index) {
              el.style.background = 'var(--bg-dropdown-hover-bg, #f0f0f0)';
              el.style.fontWeight = '500';
              el.scrollIntoView({ block: 'nearest' });
            } else {
              const isSelected =
                i < filteredOpts.length &&
                (filteredOpts[i]!.value === currentValue ||
                  String(filteredOpts[i]!.value) === String(currentValue));
              el.style.background = isSelected ? 'var(--bg-dropdown-selected-bg, #e8f0fe)' : '';
              el.style.fontWeight = isSelected ? '500' : '';
            }
          });
        }

        // Keyboard handling
        searchInput.addEventListener('keydown', (e) => {
          const total = totalCount();

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, total - 1);
            highlightAutocompleteItem(listEl, highlightedIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            highlightAutocompleteItem(listEl, highlightedIndex);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOpts.length) {
              selectOption(filteredOpts[highlightedIndex]!.value);
            } else if (highlightedIndex === filteredOpts.length && showCreateItem) {
              createNewOption();
            } else if (filteredOpts.length > 0) {
              selectOption(filteredOpts[0]!.value);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
            cancelEdit();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOpts.length) {
              selectOption(filteredOpts[highlightedIndex]!.value);
            } else if (highlightedIndex === filteredOpts.length && showCreateItem) {
              createNewOption();
            } else if (filteredOpts.length > 0) {
              selectOption(filteredOpts[0]!.value);
            } else {
              cleanup();
              cancelEdit();
            }
            // Move to next cell after commit
            const pos = editingCell;
            if (pos) {
              const state = ctx.grid.getState();
              const nextCol = e.shiftKey
                ? Math.max(pos.colIndex - 1, 0)
                : Math.min(pos.colIndex + 1, state.columns.length - 1);
              setTimeout(() => {
                ctx.grid.setSelection({
                  active: { rowIndex: pos.rowIndex, colIndex: nextCol },
                  ranges: [{ startRow: pos.rowIndex, endRow: pos.rowIndex, startCol: nextCol, endCol: nextCol }],
                });
              }, 0);
            }
          }
        });

        // Filter on input
        searchInput.addEventListener('input', () => {
          renderOptions();
        });

        document.body.appendChild(panel);
        activeDropdownPanel = panel;

        // Initial render
        renderOptions();

        // Focus the search input
        searchInput.focus();
        searchInput.select();

        // Click outside to dismiss
        let active = true;
        function onOutsideClick(ev: MouseEvent): void {
          if (!active) return;
          if (panel.contains(ev.target as Node)) return;
          cleanup();
          if (editingCell) commitEdit();
        }
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);

        function cleanup(): void {
          if (!active) return;
          active = false;
          document.removeEventListener('mousedown', onOutsideClick, true);
        }

        // Return editor shim so commitEdit can read the value
        const editorShim = {
          get value() {
            return selectedValue != null ? String(selectedValue) : searchInput.value;
          },
          set value(v: string) { searchInput.value = v; },
          focus() { searchInput.focus(); },
          removeEventListener: searchInput.removeEventListener.bind(searchInput),
          addEventListener: searchInput.addEventListener.bind(searchInput),
          setSelectionRange() {},
          dispatchEvent: searchInput.dispatchEvent.bind(searchInput),
        } as unknown as HTMLInputElement;

        activeEditor = editorShim;
        return editorShim;
      }

      // -----------------------------------------------------------------------
      // Precision helper
      // -----------------------------------------------------------------------

      function getPrecision(column: ColumnDef): number | undefined {
        if (typeof column.precision === 'number') return column.precision;
        return config.precision;
      }

      // -----------------------------------------------------------------------
      // Commit / Cancel
      // -----------------------------------------------------------------------

      function commitEdit(): boolean {
        if (!editingCell || !activeEditor) return false;

        // If dropdown is active, delegate to commitDropdown
        if (activeDropdownPanel) {
          const selectedItem = activeDropdownPanel.querySelector('.bg-dropdown-item--selected');
          const items = activeDropdownPanel.querySelectorAll('.bg-dropdown-item');
          let idx = 0;
          items.forEach((item, i) => { if (item === selectedItem) idx = i; });
          commitDropdown(idx);
          return true;
        }

        const position = editingCell;
        const prevValue = originalValue;
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];

        // Text input: parse based on cell type
        const newValue = activeEditor.value;
        const parsedValue = parseTextValue(newValue, column, prevValue);

        // Update grid data BEFORE cleanup
        if (column?.accessorKey && parsedValue !== prevValue) {
          ctx.grid.updateCell(position.rowIndex, column.id, parsedValue);
        }

        cleanupEdit();
        return true;
      }

      function parseTextValue(
        newValue: string,
        column: ColumnDef | undefined,
        prevValue: unknown,
      ): unknown {
        if (!column) return newValue;

        // Custom valueParser takes priority over all built-in parsing
        if (column.valueParser) {
          try {
            const parsed = column.valueParser(newValue);
            return parsed !== undefined ? parsed : prevValue;
          } catch {
            return prevValue;
          }
        }

        const cellType = column.cellType;

        // BigInt: parse to BigInt, reject decimals
        if (cellType === 'bigint') {
          const cleaned = newValue.replace(/[^0-9\-]/g, '');
          if (cleaned === '' || cleaned === '-') return prevValue;
          try {
            return BigInt(cleaned);
          } catch {
            return prevValue;
          }
        }

        if (cellType === 'number' || cellType === 'currency') {
          const cleaned = newValue.replace(/[^0-9.\-]/g, '');
          if (cleaned === '' || cleaned === '-') return prevValue;
          const num = Number(cleaned);
          if (isNaN(num)) return prevValue;
          // Apply precision rounding if configured
          const prec = getPrecision(column);
          if (prec != null) {
            return Number(num.toFixed(prec));
          }
          return num;
        }
        if (cellType === 'percent') {
          const cleaned = newValue.replace(/[^0-9.\-]/g, '');
          if (cleaned === '' || cleaned === '-') return prevValue;
          const num = Number(cleaned);
          if (isNaN(num)) return prevValue;
          // Avoid floating point errors: 0.08 / 100 = 0.0008 not 0.0007999...
          const decimals = (newValue.split('.')[1] || '').length + 2;
          return Number((num / 100).toFixed(decimals));
        }
        if (cellType === 'date') {
          if (newValue.trim() === '') return prevValue;
          const d = new Date(newValue);
          return isNaN(d.getTime()) ? prevValue : newValue;
        }
        if (typeof prevValue === 'boolean') {
          const lower = newValue.toLowerCase().trim();
          if (['yes', 'y', 'true', '1'].includes(lower)) return true;
          if (['no', 'n', 'false', '0'].includes(lower)) return false;
          return prevValue;
        }
        if (typeof prevValue === 'number') {
          const num = Number(newValue);
          return isNaN(num) ? prevValue : num;
        }
        return newValue;
      }

      function cancelEdit(): void {
        cleanupEdit();
      }

      function cleanupEdit(): void {
        // Clean up any active outside-click listener (masked input, etc.)
        if (activeOutsideClickCleanup) {
          activeOutsideClickCleanup();
          activeOutsideClickCleanup = null;
        }

        // Remove inline editor if present
        if (editingCell) {
          const cellEl = getCellElement(editingCell);
          if (cellEl) {
            const inlineEditor = cellEl.querySelector('.bg-cell-editor--inline');
            if (inlineEditor) inlineEditor.remove();
          }
        }

        // Remove dropdown panel if present
        if (activeDropdownPanel) {
          activeDropdownPanel.remove();
          activeDropdownPanel = null;
          activeDropdownOptions = null;
        }

        // Remove floating edit box if present
        if (activeFloatBox) {
          activeFloatBox.remove();
          activeFloatBox = null;
        }

        if (activeEditor) {
          activeEditor.removeEventListener('keydown', handleEditorKeydown);
          activeEditor.removeEventListener('blur', handleEditorBlur);
        }

        if (editingCell) {
          const cellEl = getCellElement(editingCell);
          if (cellEl) {
            cellEl.classList.remove('bg-cell--editing');
            cellEl.style.overflow = '';
            cellEl.style.zIndex = '';
          }
        }

        activeEditor = null;
        editingCell = null;
        originalValue = null;

        // Defer refresh so any in-progress pointer events can still find
        // their target cells (synchronous refresh destroys DOM during mousedown).
        // Guard: if a new edit has started by the time rAF fires, skip the
        // refresh — otherwise it would destroy the freshly-opened editor.
        requestAnimationFrame(() => {
          if (editingCell) return; // new edit already started, don't nuke it
          ctx.grid.refresh();
          // Show fill handle again
          const gc = getGridContainer();
          const fh = gc.querySelector('.bg-fill-handle') as HTMLElement | null;
          if (fh) fh.style.display = 'block';
          // Refocus the grid container so keyboard navigation resumes
          gc.focus();
        });
      }

      // -----------------------------------------------------------------------
      // Event handlers
      // -----------------------------------------------------------------------

      function handleEditorKeydown(e: KeyboardEvent): void {
        e.stopPropagation();

        if (e.key === 'Enter' && config.commitOn.includes('enter')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          if (pos) {
            const state = ctx.grid.getState();
            const nextRow = Math.min(pos.rowIndex + 1, state.data.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: nextRow, colIndex: pos.colIndex },
              ranges: [{ startRow: nextRow, endRow: nextRow, startCol: pos.colIndex, endCol: pos.colIndex }],
            });
          }
        } else if (e.key === 'Tab' && config.commitOn.includes('tab')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          if (pos) {
            const state = ctx.grid.getState();
            const nextCol = e.shiftKey
              ? Math.max(pos.colIndex - 1, 0)
              : Math.min(pos.colIndex + 1, state.columns.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: pos.rowIndex, colIndex: nextCol },
              ranges: [{ startRow: pos.rowIndex, endRow: pos.rowIndex, startCol: nextCol, endCol: nextCol }],
            });
          }
        } else if (e.key === 'Escape' && config.cancelOnEscape) {
          e.preventDefault();
          cancelEdit();
        }
      }

      function handleEditorBlur(): void {
        setTimeout(() => {
          if (editingCell) commitEdit();
        }, 100);
      }

      // -----------------------------------------------------------------------
      // API & bindings
      // -----------------------------------------------------------------------

      const api: EditingApi = {
        startEdit,
        commitEdit,
        cancelEdit,
        isEditing: () => editingCell !== null,
        getEditingCell: () => editingCell,
      };

      // Register triggers
      let clickEditFrame: number | null = null;

      if (config.editTrigger === 'dblclick') {
        ctx.on('cell:dblclick', (cell) => startEdit(cell));
      } else if (config.editTrigger === 'click') {
        ctx.on('cell:click', (cell, event) => {
          if (pendingClickEditHandoff && isSameCell(pendingClickEditHandoff, cell)) {
            pendingClickEditHandoff = null;
            return;
          }
          if (clickEditFrame !== null) cancelAnimationFrame(clickEditFrame);
          clickEditFrame = requestAnimationFrame(() => {
            clickEditFrame = null;
            startEdit(cell, undefined, event);
          });
        });
      }

      const unbindEnter = ctx.registerKeyBinding({
        key: 'Enter',
        priority: 10,
        handler: (event, cell) => {
          if (event.key !== 'Enter') return false; // defense-in-depth
          if (editingCell) return false; // let the editor's own keydown handle it
          if (cell) { startEdit(cell); return true; }
          return false;
        },
      });

      const unbindEscape = config.cancelOnEscape
        ? ctx.registerKeyBinding({
            key: 'Escape',
            priority: 10,
            handler: () => {
              if (editingCell) { cancelEdit(); return true; }
              return false;
            },
          })
        : undefined;

      // Type-to-edit: any printable character starts editing with that keystroke.
      // Always active regardless of editTrigger (standard spreadsheet behavior).
      const unbindType = ctx.registerKeyBinding({
        key: '*',
        priority: -1,
        handler: (event, cell) => {
          if (editingCell || !cell) return false;
          if (event.key.length !== 1) return false;
          if (event.ctrlKey || event.altKey || event.metaKey) return false;
          // Don't intercept typing in inputs, textareas, or contenteditable elements
          const tag = (event.target as HTMLElement)?.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
          if ((event.target as HTMLElement)?.isContentEditable) return false;
          const kbState = ctx.grid.getState();
          const column = kbState.columns[cell.colIndex];
          if (!column) return false;
          if (column.editable === false) return false;
          if (typeof column.editable === 'function') {
            const kbHs = kbState.hierarchyState;
            const di = kbHs ? (kbHs.visibleRows[cell.rowIndex] ?? cell.rowIndex) : cell.rowIndex;
            const rd = kbState.data[di];
            if (!rd || !column.editable(rd, column)) return false;
          }
          startEdit(cell, event.key);
          return true;
        },
      });

      ctx.expose(api);

      return () => {
        if (clickEditFrame !== null) cancelAnimationFrame(clickEditFrame);
        if (pendingClickEditHandoffFrame !== null) cancelAnimationFrame(pendingClickEditHandoffFrame);
        unbindEnter();
        unbindEscape?.();
        unbindType();
        if (editingCell) cancelEdit();
      };
    },
  };
}
