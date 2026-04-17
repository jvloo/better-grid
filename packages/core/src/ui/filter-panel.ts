// ============================================================================
// Filter Panel — floating UI for setting column filters
//
// Extracted from grid.ts. Owns its own panel DOM + dismiss state. Decoupled
// from the grid via dependency injection: callers supply a `getColumns()`
// function and a `getFilterApi()` function that returns the filtering
// plugin's setFilter/removeFilter methods (or undefined if absent).
// ============================================================================

import type { ColumnDef } from '../types';

// Internal column shape — only the fields filter-panel actually touches.
// Keeping this narrow avoids generic-variance headaches with ColumnDef<TData>.
type FilterableColumn = Pick<ColumnDef<unknown>, 'id' | 'header' | 'cellType'>;

export interface FilterApi {
  setFilter: (columnId: string, value: unknown, operator?: string) => void;
  removeFilter: (columnId: string) => void;
}

export interface CurrentFilter {
  columnId: string;
  value: unknown;
  operator: string;
}

export interface FilterPanelDeps {
  getColumns: () => readonly FilterableColumn[];
  getFilterApi: () => FilterApi | undefined;
}

export interface FilterPanel {
  show(event: MouseEvent, columnId: string, currentFilter?: CurrentFilter): void;
  dismiss(): void;
  isActive(): boolean;
}

const TEXT_OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
];

const NUMBER_OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less or equal' },
];

export function createFilterPanel(deps: FilterPanelDeps): FilterPanel {
  let activePanel: HTMLElement | null = null;

  function dismiss(): void {
    if (activePanel) {
      activePanel.remove();
      activePanel = null;
    }
  }

  function show(event: MouseEvent, columnId: string, currentFilter?: CurrentFilter): void {
    dismiss();

    const filterApi = deps.getFilterApi();
    if (!filterApi) return;

    const colDef = deps.getColumns().find((c) => c.id === columnId);
    const columnName = (typeof colDef?.header === 'string' ? colDef.header : undefined) ?? columnId;
    const cellType = colDef?.cellType as string | undefined;
    const isNumeric = cellType === 'number' || cellType === 'currency' || cellType === 'percent' || cellType === 'bigint';
    const operators = isNumeric ? NUMBER_OPERATORS : TEXT_OPERATORS;

    // Anchor below the header cell that was right-clicked
    const headerCell = (event.target as HTMLElement).closest('.bg-header-cell') as HTMLElement | null;
    let anchorX = event.clientX;
    let anchorY = event.clientY;
    if (headerCell) {
      const rect = headerCell.getBoundingClientRect();
      anchorX = rect.left;
      anchorY = rect.bottom;
    }

    const panel = document.createElement('div');
    panel.className = 'bg-filter-panel';
    const font = getComputedStyle(event.target as HTMLElement).font;
    panel.style.cssText = `
      position: fixed;
      left: ${anchorX}px;
      top: ${anchorY}px;
      z-index: 100;
      background: var(--bg-filter-panel-bg, #fff);
      border: 1px solid var(--bg-filter-panel-border, #d0d0d0);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 12px;
      min-width: 220px;
      font: ${font};
      font-weight: normal;
    `;

    // Title
    const title = document.createElement('div');
    title.className = 'bg-filter-panel__title';
    title.textContent = `Filter: ${columnName}`;
    title.style.cssText = 'font-weight: 600; margin-bottom: 8px; font-size: 13px;';
    panel.appendChild(title);

    // Operator select
    const select = document.createElement('select');
    select.className = 'bg-filter-panel__operator';
    select.style.cssText = `
      display: block;
      width: 100%;
      padding: 6px 8px;
      margin-bottom: 8px;
      border: 1px solid var(--bg-filter-panel-input-border, #ccc);
      border-radius: 4px;
      font: inherit;
      font-size: 13px;
      background: var(--bg-filter-panel-input-bg, #fff);
      appearance: auto;
    `;
    for (const op of operators) {
      const opt = document.createElement('option');
      opt.value = op.value;
      opt.textContent = op.label;
      select.appendChild(opt);
    }
    if (currentFilter?.operator) {
      select.value = currentFilter.operator;
    }
    panel.appendChild(select);

    // Value input
    const input = document.createElement('input');
    input.className = 'bg-filter-panel__input';
    input.type = isNumeric ? 'number' : 'text';
    input.placeholder = 'Filter value...';
    input.style.cssText = `
      display: block;
      width: 100%;
      padding: 6px 8px;
      margin-bottom: 10px;
      border: 1px solid var(--bg-filter-panel-input-border, #ccc);
      border-radius: 4px;
      font: inherit;
      font-size: 13px;
      box-sizing: border-box;
      background: var(--bg-filter-panel-input-bg, #fff);
    `;
    if (currentFilter?.value != null) {
      input.value = String(currentFilter.value);
    }
    panel.appendChild(input);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'bg-filter-panel__btn bg-filter-panel__btn--clear';
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
      padding: 5px 12px;
      border: 1px solid var(--bg-filter-panel-btn-border, #ccc);
      border-radius: 4px;
      background: var(--bg-filter-panel-btn-bg, #fff);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    `;

    const applyBtn = document.createElement('button');
    applyBtn.className = 'bg-filter-panel__btn bg-filter-panel__btn--apply';
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = `
      padding: 5px 12px;
      border: 1px solid var(--bg-filter-panel-apply-border, #1a73e8);
      border-radius: 4px;
      background: var(--bg-filter-panel-apply-bg, #1a73e8);
      color: var(--bg-filter-panel-apply-color, #fff);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    `;

    btnRow.appendChild(clearBtn);
    btnRow.appendChild(applyBtn);
    panel.appendChild(btnRow);

    function applyFilter(): void {
      const val = input.value;
      if (val === '') {
        filterApi!.removeFilter(columnId);
      } else {
        filterApi!.setFilter(columnId, val, select.value);
      }
      dismiss();
    }

    function clearFilter(): void {
      filterApi!.removeFilter(columnId);
      dismiss();
    }

    applyBtn.addEventListener('click', applyFilter);
    clearBtn.addEventListener('click', clearFilter);

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyFilter();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    });

    select.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    });

    document.body.appendChild(panel);
    activePanel = panel;

    // Keep panel within viewport
    requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        panel.style.left = `${Math.max(0, window.innerWidth - rect.width - 8)}px`;
      }
      if (rect.bottom > window.innerHeight) {
        panel.style.top = `${Math.max(0, anchorY - rect.height - 4)}px`;
      }
    });

    input.focus();

    // Close on click outside (delayed to avoid immediate dismiss from the click that opened us)
    const closeHandler = (e: MouseEvent) => {
      if (!panel.contains(e.target as Node)) {
        dismiss();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  return {
    show,
    dismiss,
    isActive: () => activePanel !== null,
  };
}
