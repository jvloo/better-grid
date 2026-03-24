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

        // Check if this should be a dropdown
        const dropdownOpts = getDropdownOptions(column, originalValue);

        // Check if text is clipped BEFORE clearing cell content
        const wasClipped = cellEl.scrollWidth > cellEl.clientWidth;

        // Prepare cell for editing — keep cell padding unchanged so text
        // position matches between display and edit modes (no glitch)
        cellEl.textContent = '';
        cellEl.classList.add('bg-cell--editing');

        if (dropdownOpts) {
          activeEditor = createDropdown(cellEl, dropdownOpts, originalValue);
        } else {
          // For percent: show user-friendly value (5 instead of 0.05)
          let rawStr = originalValue != null ? String(originalValue) : '';
          if (column.cellType === 'percent' && typeof originalValue === 'number') {
            // Avoid floating point: 0.0008 * 100 = 0.08 not 0.07999...
            rawStr = String(parseFloat((originalValue * 100).toPrecision(12)));
          }
          const editValue = initialValue ?? rawStr;
          activeEditor = createTextInput(cellEl, editValue, initialValue !== undefined, wasClipped);
        }
      }

      // -----------------------------------------------------------------------
      // Text input editor
      // -----------------------------------------------------------------------

      function createTextInput(
        cellEl: HTMLElement,
        value: string,
        cursorAtEnd: boolean,
        wasClipped = false,
      ): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor';
        input.value = value;
        input.style.cssText = INPUT_CSS;

        // If clipped, create a floating textarea on top of everything.
        // Textarea handles both single-line and multi-line — no switching needed.
        if (wasClipped) {
          const cellRect = cellEl.getBoundingClientRect();
          const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
          const gridRect = gridEl?.getBoundingClientRect();
          const cellPadding = getComputedStyle(cellEl).padding;
          const cellFont = getComputedStyle(cellEl).font;
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
            top: ${cellRect.top - borderW}px; left: ${cellRect.left - borderW}px;
            min-width: ${cellRect.width + borderW * 2}px; max-width: ${fullWidth + borderW * 2}px;
            background: #fff; border: ${borderW}px solid var(--bg-active-border, #1a73e8);
            border-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          `;

          // Use contenteditable div — naturally supports vertical centering
          // (via flexbox) and word-wrap without textarea quirks
          const ed = document.createElement('div');
          ed.className = 'bg-cell-editor';
          ed.contentEditable = 'true';
          ed.textContent = value;
          ed.style.cssText = `
            outline:none; margin:0;
            font:${cellFont}; line-height:1.5; color:inherit;
            background:transparent; box-sizing:border-box;
            padding:${cellPadding};
            min-height:${cellRect.height}px;
            max-height:${cellRect.height * 4}px;
            overflow:auto;
            white-space:pre-wrap; word-break:break-word;
            display:flex; align-items:center;
          `;

          floatBox.appendChild(ed);
          document.body.appendChild(floatBox);

          function autoSize(): void {
            measureSpan.textContent = ed.textContent || ' ';
            const textWidth = measureSpan.offsetWidth + 16;
            const bw2 = borderW * 2;

            if (textWidth <= maxRightWidth) {
              floatBox.style.left = `${cellRect.left - borderW}px`;
              floatBox.style.width = `${Math.max(cellRect.width, textWidth) + bw2}px`;
            } else {
              floatBox.style.left = `${gridLeft - borderW}px`;
              floatBox.style.width = `${fullWidth + bw2}px`;
            }

            // When content wraps, switch from flex centering to block flow
            // Add vertical padding on multi-line to match horizontal padding
            const horizPadVal = parseFloat(getComputedStyle(cellEl).paddingLeft) || 12;
            if (ed.scrollHeight > cellRect.height) {
              ed.style.display = 'block';
              ed.style.lineHeight = '';
              ed.style.padding = `${horizPadVal}px`;
            } else {
              ed.style.display = 'flex';
              ed.style.alignItems = 'center';
              ed.style.padding = cellPadding;
            }
          }

          // Track scroll to reposition float box
          const scrollEl = cellEl.closest('.bg-grid__scroll') as HTMLElement | null;

          function syncPosition(): void {
            const cr = cellEl.getBoundingClientRect();
            const gr = gridEl?.getBoundingClientRect();

            // Hide if cell scrolled out of the grid viewport
            if (gr) {
              const headerH = parseFloat(gridEl?.querySelector('.bg-grid__headers')?.getBoundingClientRect().height + '' || '0');
              const cellVisible = cr.bottom > (gr.top + headerH) && cr.top < gr.bottom && cr.right > gr.left && cr.left < gr.right;
              floatBox.style.display = cellVisible ? '' : 'none';
              if (!cellVisible) return;
            }

            // Update position
            measureSpan.textContent = ed.textContent || ' ';
            const textWidth = measureSpan.offsetWidth + 16;
            const bw2 = borderW * 2;
            const curMaxRight = gr ? gr.right - cr.left : cr.width;
            const curFullWidth = gr?.width ?? cr.width;
            const curGridLeft = gr?.left ?? cr.left;

            floatBox.style.top = `${cr.top - borderW}px`;
            if (textWidth <= curMaxRight) {
              floatBox.style.left = `${cr.left - borderW}px`;
              floatBox.style.width = `${Math.max(cr.width, textWidth) + bw2}px`;
            } else {
              floatBox.style.left = `${curGridLeft - borderW}px`;
              floatBox.style.width = `${curFullWidth + bw2}px`;
            }
          }

          if (scrollEl) {
            scrollEl.addEventListener('scroll', syncPosition);
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
            }
            handleEditorKeydown(e);
          });
          ed.addEventListener('blur', () => {
            measureSpan.remove();
            floatBox.remove();
            if (scrollEl) scrollEl.removeEventListener('scroll', syncPosition);
          }, { once: true });
          ed.addEventListener('blur', handleEditorBlur);

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

        // Non-clipped: inline edit, but upgrade to float if typing overflows
        cellEl.appendChild(input);
        input.focus();
        if (cursorAtEnd) {
          input.setSelectionRange(value.length, value.length);
        } else {
          input.select();
        }

        function checkOverflow(): void {
          if (input.scrollWidth <= input.clientWidth) return;
          // Text overflows — upgrade to floating textarea
          const curValue = input.value;
          const sel = [input.selectionStart, input.selectionEnd];
          input.removeEventListener('input', checkOverflow);
          input.removeEventListener('keydown', handleEditorKeydown);
          input.removeEventListener('blur', handleEditorBlur);
          input.remove();
          // Create float directly (reuse the wasClipped=true path)
          activeEditor = createTextInput(cellEl, curValue, true, true);
          activeEditor.setSelectionRange(sel[0] ?? curValue.length, sel[1] ?? curValue.length);
          activeEditor.dispatchEvent(new Event('input'));
        }

        input.addEventListener('input', checkOverflow);
        input.addEventListener('keydown', handleEditorKeydown);
        input.addEventListener('blur', handleEditorBlur);
        return input;
      }

      // -----------------------------------------------------------------------
      // Dropdown editor
      // -----------------------------------------------------------------------

      function createDropdown(
        cellEl: HTMLElement,
        opts: DropdownOption[],
        currentValue: unknown,
      ): HTMLInputElement {
        activeDropdownOptions = opts;

        // Hidden input for focus and keyboard handling
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor bg-cell-editor--dropdown-trigger';
        input.readOnly = true;
        input.style.cssText = INPUT_CSS + `
          cursor: pointer;
          background: transparent;
          background-image: ${CHEVRON_SVG};
          background-repeat: no-repeat;
          background-position: right 2px center;
          padding-right: 18px;
        `;

        // Show the current label
        const currentOpt = opts.find((o) => o.value === currentValue || String(o.value) === String(currentValue));
        input.value = currentOpt?.label ?? String(currentValue ?? '');

        cellEl.appendChild(input);
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
          font: ${cellFont};
        `;

        let selectedIndex = opts.findIndex((o) => o.value === currentValue || String(o.value) === String(currentValue));

        for (let i = 0; i < opts.length; i++) {
          const opt = opts[i]!;
          const item = document.createElement('div');
          item.className = 'bg-dropdown-item' + (i === selectedIndex ? ' bg-dropdown-item--selected' : '');
          item.textContent = opt.label;
          item.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            user-select: none;
            font: inherit;
            ${i === selectedIndex ? 'background: var(--bg-dropdown-selected-bg, #e8f0fe); font-weight: 500;' : ''}
          `;
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
        column: { cellType?: string } | undefined,
        prevValue: unknown,
      ): unknown {
        if (!column) return newValue;

        const cellType = column.cellType;
        if (cellType === 'number' || cellType === 'currency') {
          const num = Number(newValue.replace(/[^0-9.\-]/g, ''));
          return isNaN(num) ? prevValue : num;
        }
        if (cellType === 'percent') {
          const num = Number(newValue.replace(/[^0-9.\-]/g, ''));
          if (isNaN(num)) return prevValue;
          // Avoid floating point errors: 0.08 / 100 = 0.0008 not 0.0007999...
          const decimals = (newValue.split('.')[1] || '').length + 2;
          return Number((num / 100).toFixed(decimals));
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

        ctx.grid.refresh();
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
        handler: (_event, cell) => {
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

      const unbindType = config.editTrigger === 'type'
        ? ctx.registerKeyBinding({
            key: '*',
            priority: -1,
            handler: (event, cell) => {
              if (editingCell || !cell) return false;
              if (event.key.length !== 1) return false;
              if (event.ctrlKey || event.altKey || event.metaKey) return false;
              startEdit(cell, event.key);
              return true;
            },
          })
        : undefined;

      ctx.expose(api);

      return () => {
        unbindEnter();
        unbindEscape?.();
        unbindType?.();
        if (editingCell) cancelEdit();
      };
    },
  };
}
