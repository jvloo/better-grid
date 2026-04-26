import { useMemo, type CSSProperties } from 'react';
import { useGrid, BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, hierarchy } from '@better-grid/plugins';
import { gantt } from '@better-grid/pro';
import { FSBT_PROGRAM_ROWS, formatMonYY, columnToDate, type FsbtProgramRow } from './_fsbt-program-data';

/**
 * Read-only program summary used at the top of FsbtCost / FsbtRevenue —
 * mirrors the the production reference feasibility layout where each tab shows the program
 * overview above its main grid.
 */
export function FsbtProgramSummary() {
  const ts = useMemo(() => timeSeries({
    start: '2023-08-01',
    end: '2026-10-01',
    locale: 'en-AU',
    columnWidth: 80,
    columnDefaults: {
      align: 'center' as never,
      cellType: 'gantt' as never,
      editable: false,
    },
  }), []);

  const columns = useMemo<ColumnDef<FsbtProgramRow>[]>(() => [
    {
      id: 'code', field: 'code', headerName: 'Code', width: 45, align: 'right' as const, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as FsbtProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.code;
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = isParent ? '#101828' : '#282F3D';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.padding = '8.4px 6px';
        container.style.justifyContent = 'flex-end';
      },
    },
    {
      id: 'name', field: 'name', headerName: 'Phase', width: 240, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as FsbtProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.name;
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = '#101828';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.paddingLeft = '14px';
      },
    },
    {
      id: 'duration', field: 'duration', headerName: 'Duration (months)', width: 110, align: 'center' as const, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as FsbtProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.duration != null ? String(row.duration) : '';
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
      },
    },
    {
      id: 'start', field: 'start', headerName: 'Start', width: 90, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as FsbtProgramRow;
        const isParent = row.parentId === null;
        container.textContent = formatMonYY(row.start);
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.paddingLeft = '12px';
      },
    },
    {
      id: 'end', field: 'end', headerName: 'End', width: 90, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as FsbtProgramRow;
        const isParent = row.parentId === null;
        container.textContent = formatMonYY(row.end);
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.paddingLeft = '12px';
      },
    },
    {
      id: 'collapse', headerName: '', width: 40, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as FsbtProgramRow;
        container.style.backgroundColor = row.parentId === null ? '#F8F8F8' : '';
      },
    },
    ...ts.columns,
  ], [ts]);

  const plugins = useMemo(() => [
    formatting({ locale: 'en-AU', dateFormat: 'month-year' }),
    hierarchy({ toggleColumn: 'collapse', toggleStyle: 'chevron' }),
    // cellRenderers() is auto-included by useGrid (always wired)
    gantt({
      dateColumnPrefix: 'm_',
      startColumnField: 'startColumn',
      endColumnField: 'endColumn',
      colors: { neutral: '#86D9FC', ahead: '#86D9FC', late: '#86D9FC' },
      parentColor: '#518BAA',
      barHeight: 0.55,
      parentRowBackground: '#F8F8F8',
      columnToDate,
      formatDate: formatMonYY,
      // Read-only summary — no drag-to-move/resize on the Gantt bars
      dragEnabled: false,
    }),
  ], []);

  const grid = useGrid<FsbtProgramRow>({
    data: FSBT_PROGRAM_ROWS,
    columns,
    mode: null,
    plugins,
    frozen: { left: 6, clip: { minVisible: 2 } },
    striped: true,
    hierarchy: {
      getRowId: (row: FsbtProgramRow) => row.id,
      getParentId: (row: FsbtProgramRow) => row.parentId,
      defaultExpanded: true,
    },
    headerHeight: 40,
    rowHeight: 40,
  });

  return (
    <BetterGrid<FsbtProgramRow>
      grid={grid}
      height={320}
      style={{
        borderRadius: 12,
        '--bg-scrollbar-inset': '12px',
        '--bg-header-bg': '#EAECF0',
      } as CSSProperties}
    />
  );
}

