// ============================================================================
// Editing Plugin — Cell editing with text input & dropdown support
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition, ColumnDef } from '@better-grid/core';

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

export function editing(options?: EditingOptions): GridPlugin<'editing'> {
  const config = {
    editTrigger: options?.editTrigger ?? 'dblclick',
    commitOn: options?.commitOn ?? ['enter', 'tab'],
    cancelOnEscape: options?.cancelOnEscape ?? true,
    booleanLabels: options?.booleanLabels ?? (['Yes', 'No'] as [string, string]),
    precision: options?.precision,
    editorMode: options?.editorMode ?? 'float',
  };

  return {
    id: 'editing',

    init(ctx: PluginContext) {
      let editingCell: CellPosition | null = null;
      let activeEditor: HTMLInputElement | null = null;
      let activeDropdownPanel: HTMLElement | null = null;
      let activeDropdownOptions: DropdownOption[] | null = null;
      let originalValue: unknown = null;

      function getCellElement(pos: CellPosition): HTMLElement | null {
        const selector = `.bg-cell[data-row="${pos.rowIndex}"][data-col="${pos.colIndex}"]`;
        return document.querySelector(selector);
      }

      // -----------------------------------------------------------------------
      // Determine editor type
      // -----------------------------------------------------------------------

      function getDropdownOptions(
        column: ColumnDef,
        value: unknown,
      ): DropdownOption[] | null {
        // column.editor: 'text' forces text input, skips all dropdown logic
        if (column.editor === 'text') return null;

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

      function startEdit(position: CellPosition, initialValue?: string): void {
        if (editingCell) commitEdit();

        const cellEl = getCellElement(position);
        if (!cellEl) return;

        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return;
        if (column.editable === false) return;

        editingCell = position;

        // Get current raw value
        const data = state.data[position.rowIndex];
        if (column.accessorKey && data) {
          originalValue = (data as Record<string, unknown>)[column.accessorKey];
        } else {
          originalValue = cellEl.textContent;
        }

        // Check if this should be a dropdown or autocomplete
        const isAutocomplete = column.editor === 'autocomplete';
        const dropdownOpts = getDropdownOptions(column, originalValue);

        // Prepare cell for editing — keep cell padding unchanged so text
        // position matches between display and edit modes (no glitch)
        cellEl.textContent = '';
        cellEl.classList.add('bg-cell--editing');

        // Hide fill handle during editing
        const fillHandle = document.querySelector('.bg-fill-handle') as HTMLElement | null;
        if (fillHandle) fillHandle.style.display = 'none';

        if (isAutocomplete) {
          const opts = dropdownOpts ?? [];
          activeEditor = createAutocomplete(cellEl, opts, originalValue, column);
        } else if (dropdownOpts) {
          activeEditor = createDropdown(cellEl, dropdownOpts, originalValue, column);
        } else {
          // Determine display string for the editor
          let rawStr = originalValue != null ? String(originalValue) : '';

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
          const isDateEditor = column.editor === 'date' ||
            (!column.editor && column.cellType === 'date');
          const isNumberEditor = column.editor === 'number' ||
            (!column.editor && (column.cellType === 'number' || column.cellType === 'currency'));

          const editValue = initialValue ?? rawStr;

          if (isDateEditor) {
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
          const cellRect = cellEl.getBoundingClientRect();
          const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
          const gridRect = gridEl?.getBoundingClientRect();
          const cellComputed = getComputedStyle(cellEl);
          const cellPadding = cellComputed.padding;
          const cellFont = cellComputed.font;
          const cellTextAlign = cellComputed.textAlign;
          const cellLineHeight = cellComputed.lineHeight;
          const cellLetterSpacing = cellComputed.letterSpacing;
          const maxRightWidth = gridRect ? gridRect.right - cellRect.left : cellRect.width;
          const fullWidth = gridRect?.width ?? cellRect.width;
          const gridLeft = gridRect?.left ?? cellRect.left;

          // Measure span for auto-sizing
          const measureSpan = document.createElement('span');
          measureSpan.style.cssText = `position:fixed;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;font:${cellFont};padding:${cellPadding};`;
          document.body.appendChild(measureSpan);

          // Create float box
          const floatBox = document.createElement('div');
          floatBox.className = 'bg-cell-editor-float';
          const borderW = 2;
          floatBox.style.cssText = `
            position: fixed; z-index: 200; box-sizing: border-box;
            top: ${cellRect.top}px; left: ${cellRect.left}px;
            min-width: ${cellRect.width}px; max-width: ${fullWidth}px;
            background: #fff; border: ${borderW}px solid var(--bg-active-border, #1a73e8);
            border-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          `;

          // Use contenteditable div — naturally supports vertical centering
          // (via flexbox) and word-wrap without textarea quirks
          const ed = document.createElement('div');
          ed.className = 'bg-cell-editor';
          ed.contentEditable = 'true';
          ed.textContent = value;
          // Match cell position exactly. Use normal line-height + vertical padding
          // for centering, so text selection highlight doesn't span full cell height.
          const fontSize = parseFloat(cellComputed.fontSize) || 14;
          const contentLineHeight = Math.round(fontSize * 1.4);
          const editorHeight = cellRect.height - borderW * 2;
          const vertPad = Math.max(0, Math.floor((editorHeight - contentLineHeight) / 2));
          const hPad = parseFloat(cellComputed.paddingLeft) || 12;

          ed.style.cssText = `
            outline:none; margin:0;
            font-family:${cellComputed.fontFamily}; font-size:${cellComputed.fontSize};
            font-weight:${cellComputed.fontWeight}; line-height:${contentLineHeight}px;
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
              // Allow navigation and control keys
              if (['Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
                   'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
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

          // Track scroll to reposition float box
          const scrollEl = gridEl?.querySelector('.bg-grid__scroll') as HTMLElement | null;
          const editRow = cellEl.dataset.row;
          const editCol = cellEl.dataset.col;

          function syncPosition(): void {
            // Find current cell element by row/col (may be recycled by virtualization)
            const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
            const gr = gridEl?.getBoundingClientRect();

            if (!currentCell || !gr) {
              // Cell not in DOM (virtualized out) — hide float
              floatBox.style.visibility = 'hidden';
              return;
            }

            const cr = currentCell.getBoundingClientRect();
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

          function onScroll(): void { requestAnimationFrame(syncPosition); }
          if (scrollEl) {
            scrollEl.addEventListener('scroll', onScroll);
          }

          autoSize();
          ed.addEventListener('input', autoSize);
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
            if (scrollEl) scrollEl.removeEventListener('scroll', onScroll);
            document.removeEventListener('mousedown', onOutsideClick, true);
          }

          // Commit on click outside the float box (not blur-based)
          function onOutsideClick(e: MouseEvent): void {
            if (!floatActive) return;
            if (floatBox.contains(e.target as Node)) return;
            cleanupFloat();
            if (editingCell) commitEdit();
          }
          // Delay to avoid the dblclick that opened the editor
          setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);

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
            if (['Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
                 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
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

        cellEl.appendChild(input);
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

      function createDateInput(
        cellEl: HTMLElement,
        value: string,
      ): HTMLInputElement {
        const cellRect = cellEl.getBoundingClientRect();
        const cellFont = getComputedStyle(cellEl).font;
        const cellPadding = getComputedStyle(cellEl).padding;

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
          if (floatBox.contains(ev.target as Node)) return;
          cleanup();
          if (editingCell) commitEdit();
        }
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);

        let active = true;
        function cleanup(): void {
          if (!active) return;
          active = false;
          floatBox.remove();
          document.removeEventListener('mousedown', onOutsideClick, true);
        }

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
            background-position: right 2px center;
            padding-right: 18px;
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

        // Find current label
        const currentOpt = opts.find(
          (o) => o.value === currentValue || String(o.value) === String(currentValue),
        );
        const currentLabel = currentOpt?.label ?? String(currentValue ?? '');

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
        // First-class column.precision, then legacy meta.precision, then global config
        if (typeof column.precision === 'number') return column.precision;
        const metaPrecision = column.meta?.precision;
        if (typeof metaPrecision === 'number') return metaPrecision;
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

        // Custom valueModifier.parse takes priority over all built-in parsing
        if (column.valueModifier?.parse) {
          try {
            const parsed = column.valueModifier.parse(newValue);
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
        document.querySelectorAll('.bg-cell-editor-float').forEach(el => el.remove());

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
        // their target cells (synchronous refresh destroys DOM during mousedown)
        requestAnimationFrame(() => {
          ctx.grid.refresh();
          // Show fill handle again
          const fh = document.querySelector('.bg-fill-handle') as HTMLElement | null;
          if (fh) fh.style.display = 'block';
          // Refocus the grid container so keyboard navigation resumes
          const gridEl = document.querySelector('.bg-grid') as HTMLElement | null;
          gridEl?.focus();
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
      if (config.editTrigger === 'dblclick') {
        ctx.on('cell:dblclick', (cell) => startEdit(cell));
      } else if (config.editTrigger === 'click') {
        ctx.on('cell:click', (cell) => startEdit(cell));
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
          const column = ctx.grid.getState().columns[cell.colIndex];
          if (column?.editable === false) return false;
          startEdit(cell, event.key);
          return true;
        },
      });

      ctx.expose(api);

      return () => {
        unbindEnter();
        unbindEscape?.();
        unbindType();
        if (editingCell) cancelEdit();
      };
    },
  };
}
