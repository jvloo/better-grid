// ============================================================================
// Search Plugin — Find & highlight across all cells
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';

export interface SearchOptions {
  /** Case-sensitive search. Default: false */
  caseSensitive?: boolean;
  /** CSS class for highlighted cells. Default: 'bg-cell--search-match' */
  matchClass?: string;
}

export interface SearchApi {
  /** Search for text across all cells. Returns number of matches. */
  search(query: string): number;
  /** Clear search highlights */
  clear(): void;
  /** Navigate to next match */
  next(): void;
  /** Navigate to previous match */
  prev(): void;
  /** Get current match info */
  getMatchInfo(): { current: number; total: number };
}

interface MatchPosition {
  rowIndex: number;
  colIndex: number;
}

export function search(options?: SearchOptions): GridPlugin<'search'> {
  const caseSensitive = options?.caseSensitive ?? false;
  const matchClass = options?.matchClass ?? 'bg-cell--search-match';

  return {
    id: 'search',
    init(ctx: PluginContext) {
      let matches: MatchPosition[] = [];
      let currentMatchIndex = -1;
      let currentQuery = '';

      function doSearch(query: string): number {
        currentQuery = query;
        matches = [];
        currentMatchIndex = -1;

        if (!query) {
          clearHighlights();
          return 0;
        }

        const state = ctx.grid.getState();
        const data = state.data;
        const columns = state.columns;
        const q = caseSensitive ? query : query.toLowerCase();

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
          const row = data[rowIndex];
          for (let colIndex = 0; colIndex < columns.length; colIndex++) {
            const col = columns[colIndex];
            let value: unknown;
            if (col.accessorFn) {
              value = col.accessorFn(row as never, rowIndex);
            } else if (col.accessorKey) {
              value = (row as Record<string, unknown>)[col.accessorKey];
            }

            if (value == null) continue;

            const str = caseSensitive ? String(value) : String(value).toLowerCase();
            if (str.includes(q)) {
              matches.push({ rowIndex, colIndex });
            }
          }
        }

        if (matches.length > 0) {
          currentMatchIndex = 0;
          navigateToMatch(0);
        }

        applyHighlights();
        return matches.length;
      }

      function clearSearch(): void {
        currentQuery = '';
        matches = [];
        currentMatchIndex = -1;
        clearHighlights();
      }

      function navigateToMatch(index: number): void {
        if (matches.length === 0) return;
        currentMatchIndex = ((index % matches.length) + matches.length) % matches.length;
        const match = matches[currentMatchIndex];

        // Select the matched cell
        ctx.grid.setSelection({
          active: { rowIndex: match.rowIndex, colIndex: match.colIndex },
          ranges: [{
            startRow: match.rowIndex,
            endRow: match.rowIndex,
            startCol: match.colIndex,
            endCol: match.colIndex,
          }],
        });

        // Scroll the matched cell into view
        if (typeof ctx.grid.scrollTo === 'function') {
          ctx.grid.scrollTo(match.rowIndex, match.colIndex);
        }
        ctx.grid.refresh();
        requestAnimationFrame(applyHighlights);
      }

      function nextMatch(): void {
        if (matches.length === 0) return;
        navigateToMatch(currentMatchIndex + 1);
      }

      function prevMatch(): void {
        if (matches.length === 0) return;
        navigateToMatch(currentMatchIndex - 1);
      }

      function applyHighlights(): void {
        clearHighlights();
        // Apply highlight class to visible matched cells
        for (const match of matches) {
          const cellEl = document.querySelector(
            `.bg-cell[data-row="${match.rowIndex}"][data-col="${match.colIndex}"]`
          );
          if (cellEl) {
            cellEl.classList.add(matchClass);
            // Current match gets extra styling
            if (matches[currentMatchIndex] === match) {
              cellEl.classList.add('bg-cell--search-current');
            }
          }
        }
      }

      function clearHighlights(): void {
        document.querySelectorAll(`.${matchClass}`).forEach(el =>
          el.classList.remove(matchClass)
        );
        document.querySelectorAll('.bg-cell--search-current').forEach(el =>
          el.classList.remove('bg-cell--search-current')
        );
      }

      // Re-apply highlights after render (cells may be recycled)
      // Listen for scroll or render events to re-apply
      const origRefresh = ctx.grid.refresh;
      ctx.grid.refresh = function () {
        origRefresh.call(ctx.grid);
        if (currentQuery) {
          requestAnimationFrame(applyHighlights);
        }
      };

      // Ctrl+F binding
      const unbindFind = ctx.registerKeyBinding({
        key: '*',
        priority: 8,
        handler: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            showSearchBar();
            return true;
          }
          return false;
        },
      });

      // F3 or Ctrl+G for next
      const unbindNext = ctx.registerKeyBinding({
        key: 'F3',
        priority: 8,
        handler: (event) => {
          if (matches.length > 0) {
            event.preventDefault();
            if (event.shiftKey) prevMatch(); else nextMatch();
            return true;
          }
          return false;
        },
      });

      let searchBarEl: HTMLElement | null = null;

      function showSearchBar(): void {
        if (searchBarEl) {
          // Focus existing
          const input = searchBarEl.querySelector('input');
          input?.focus();
          input?.select();
          return;
        }

        const gridEl = document.querySelector('.bg-grid') as HTMLElement;
        if (!gridEl) return;

        const bar = document.createElement('div');
        bar.className = 'bg-search-bar';
        bar.style.cssText = `
          position: absolute; top: 0; right: 0; z-index: 100;
          display: flex; align-items: center; gap: 6px;
          padding: 6px 10px;
          background: var(--bg-search-bar-bg, #fff);
          border: 1px solid var(--bg-search-bar-border, #d0d0d0);
          border-radius: 0 0 0 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          font-size: 13px;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Find...';
        input.value = currentQuery;
        input.style.cssText = `
          border: 1px solid #d0d0d0; border-radius: 4px;
          padding: 4px 8px; font: inherit; outline: none;
          width: 180px;
        `;

        const info = document.createElement('span');
        info.style.cssText = 'color: #888; font-size: 11px; min-width: 50px;';
        info.textContent = matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '\u25B2';
        prevBtn.title = 'Previous (Shift+F3)';
        prevBtn.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 4px; background: #fff; cursor: pointer; padding: 2px 6px; font-size: 10px;';
        prevBtn.addEventListener('click', () => { prevMatch(); updateInfo(); });

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '\u25BC';
        nextBtn.title = 'Next (F3)';
        nextBtn.style.cssText = prevBtn.style.cssText;
        nextBtn.addEventListener('click', () => { nextMatch(); updateInfo(); });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u2715';
        closeBtn.style.cssText = 'border: none; background: transparent; cursor: pointer; color: #888; font-size: 14px; padding: 2px 4px;';
        closeBtn.addEventListener('click', dismissSearchBar);

        function updateInfo(): void {
          info.textContent = matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : 'No results';
        }

        input.addEventListener('input', () => {
          doSearch(input.value);
          updateInfo();
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            dismissSearchBar();
          } else if (e.key === 'Enter') {
            if (e.shiftKey) prevMatch(); else nextMatch();
            updateInfo();
          }
        });

        bar.appendChild(input);
        bar.appendChild(info);
        bar.appendChild(prevBtn);
        bar.appendChild(nextBtn);
        bar.appendChild(closeBtn);

        gridEl.style.position = 'relative';
        gridEl.appendChild(bar);
        searchBarEl = bar;

        input.focus();
        if (currentQuery) input.select();
      }

      function dismissSearchBar(): void {
        if (searchBarEl) {
          searchBarEl.remove();
          searchBarEl = null;
        }
        clearSearch();
        // Refocus grid
        const gridEl = document.querySelector('.bg-grid') as HTMLElement;
        gridEl?.focus();
      }

      const api: SearchApi = {
        search: doSearch,
        clear: clearSearch,
        next: nextMatch,
        prev: prevMatch,
        getMatchInfo: () => ({ current: currentMatchIndex + 1, total: matches.length }),
      };

      ctx.expose(api);

      return () => {
        unbindFind();
        unbindNext();
        dismissSearchBar();
        clearHighlights();
      };
    },
  };
}
