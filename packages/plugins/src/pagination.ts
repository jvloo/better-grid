// ============================================================================
// Pagination Plugin — Page-based navigation for data grids
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';

export interface PaginationOptions {
  /** Rows per page. Default: 20 */
  pageSize?: number;
  /** Available page size options. Default: [10, 20, 50, 100] */
  pageSizeOptions?: number[];
  /** Show page size selector. Default: true */
  showPageSizeSelector?: boolean;
  /** Callback when page changes */
  onPageChange?: (page: number, pageSize: number) => void;
}

export interface PaginationApi {
  getPage(): number;
  getPageSize(): number;
  getPageCount(): number;
  getTotalRows(): number;
  setPage(page: number): void;
  setPageSize(size: number): void;
  nextPage(): void;
  prevPage(): void;
  firstPage(): void;
  lastPage(): void;
}

export function pagination(options?: PaginationOptions): GridPlugin<'pagination'> {
  const config = {
    pageSize: options?.pageSize ?? 20,
    pageSizeOptions: options?.pageSizeOptions ?? [10, 20, 50, 100],
    showPageSizeSelector: options?.showPageSizeSelector ?? true,
    onPageChange: options?.onPageChange,
  };

  return {
    id: 'pagination',
    init(ctx: PluginContext) {
      let currentPage = 0;
      let pageSize = config.pageSize;
      let fullData: unknown[] = [];
      let paginationBar: HTMLElement | null = null;

      // Save the full dataset and show only the current page
      function init(): void {
        fullData = [...ctx.grid.getData()];
        applyPage();
      }

      function getPageCount(): number {
        return Math.max(1, Math.ceil(fullData.length / pageSize));
      }

      function applyPage(): void {
        const start = currentPage * pageSize;
        const end = start + pageSize;
        const pageData = fullData.slice(start, end);
        ctx.grid.setData(pageData as typeof fullData);
        updatePaginationBar();
        config.onPageChange?.(currentPage, pageSize);
      }

      function setPage(page: number): void {
        const maxPage = getPageCount() - 1;
        currentPage = Math.max(0, Math.min(page, maxPage));
        applyPage();
      }

      function setPageSize(size: number): void {
        pageSize = size;
        currentPage = 0; // Reset to first page
        applyPage();
      }

      // Create pagination bar UI below the grid
      function createPaginationBar(): void {
        const gridEl = document.querySelector('.bg-grid') as HTMLElement;
        if (!gridEl || !gridEl.parentElement) return;

        const bar = document.createElement('div');
        bar.className = 'bg-pagination-bar';
        bar.style.cssText = `
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 12px; font-size: 13px; color: #666;
          border: 1px solid #e0e0e0; border-top: none;
          border-radius: 0 0 8px 8px; background: #fafafa;
        `;

        // Left: page size selector
        const leftSection = document.createElement('div');
        leftSection.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        if (config.showPageSizeSelector) {
          const label = document.createElement('span');
          label.textContent = 'Rows per page:';
          leftSection.appendChild(label);

          const select = document.createElement('select');
          select.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 4px; padding: 2px 6px; font: inherit; cursor: pointer;';
          for (const size of config.pageSizeOptions) {
            const opt = document.createElement('option');
            opt.value = String(size);
            opt.textContent = String(size);
            if (size === pageSize) opt.selected = true;
            select.appendChild(opt);
          }
          select.addEventListener('change', () => {
            setPageSize(Number(select.value));
          });
          leftSection.appendChild(select);
        }

        bar.appendChild(leftSection);

        // Center: info
        const info = document.createElement('span');
        info.className = 'bg-pagination-info';
        bar.appendChild(info);

        // Right: navigation buttons
        const rightSection = document.createElement('div');
        rightSection.style.cssText = 'display: flex; align-items: center; gap: 4px;';

        const btnStyle = `
          border: 1px solid #d0d0d0; border-radius: 4px; background: #fff;
          padding: 4px 8px; cursor: pointer; font-size: 12px;
          min-width: 28px; text-align: center;
        `;

        const firstBtn = document.createElement('button');
        firstBtn.textContent = '\u00AB';
        firstBtn.title = 'First page';
        firstBtn.style.cssText = btnStyle;
        firstBtn.addEventListener('click', () => setPage(0));

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '\u2039';
        prevBtn.title = 'Previous page';
        prevBtn.style.cssText = btnStyle;
        prevBtn.addEventListener('click', () => setPage(currentPage - 1));

        const pageInfo = document.createElement('span');
        pageInfo.className = 'bg-pagination-page';
        pageInfo.style.cssText = 'padding: 0 8px; min-width: 80px; text-align: center;';

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '\u203A';
        nextBtn.title = 'Next page';
        nextBtn.style.cssText = btnStyle;
        nextBtn.addEventListener('click', () => setPage(currentPage + 1));

        const lastBtn = document.createElement('button');
        lastBtn.textContent = '\u00BB';
        lastBtn.title = 'Last page';
        lastBtn.style.cssText = btnStyle;
        lastBtn.addEventListener('click', () => setPage(getPageCount() - 1));

        rightSection.appendChild(firstBtn);
        rightSection.appendChild(prevBtn);
        rightSection.appendChild(pageInfo);
        rightSection.appendChild(nextBtn);
        rightSection.appendChild(lastBtn);
        bar.appendChild(rightSection);

        // Insert after the grid
        gridEl.parentElement.insertBefore(bar, gridEl.nextSibling);
        paginationBar = bar;
      }

      function updatePaginationBar(): void {
        if (!paginationBar) return;

        const total = fullData.length;
        const start = currentPage * pageSize + 1;
        const end = Math.min((currentPage + 1) * pageSize, total);
        const pageCount = getPageCount();

        const info = paginationBar.querySelector('.bg-pagination-info') as HTMLElement;
        if (info) info.textContent = `${start}-${end} of ${total}`;

        const pageEl = paginationBar.querySelector('.bg-pagination-page') as HTMLElement;
        if (pageEl) pageEl.textContent = `Page ${currentPage + 1} of ${pageCount}`;

        // Disable buttons at boundaries
        const buttons = paginationBar.querySelectorAll('button');
        if (buttons.length >= 4) {
          (buttons[0] as HTMLButtonElement).disabled = currentPage === 0;
          (buttons[1] as HTMLButtonElement).disabled = currentPage === 0;
          (buttons[2] as HTMLButtonElement).disabled = currentPage >= pageCount - 1;
          (buttons[3] as HTMLButtonElement).disabled = currentPage >= pageCount - 1;
        }
      }

      // Initialize after a small delay to let the grid mount
      // Guard against React StrictMode double-init
      setTimeout(() => {
        if (paginationBar) return; // already initialized
        init();
        createPaginationBar();
        updatePaginationBar(); // populate info after bar is created
      }, 0);

      const api: PaginationApi = {
        getPage: () => currentPage,
        getPageSize: () => pageSize,
        getPageCount,
        getTotalRows: () => fullData.length,
        setPage,
        setPageSize,
        nextPage: () => setPage(currentPage + 1),
        prevPage: () => setPage(currentPage - 1),
        firstPage: () => setPage(0),
        lastPage: () => setPage(getPageCount() - 1),
      };

      ctx.expose(api);

      return () => {
        paginationBar?.remove();
      };
    },
  };
}
