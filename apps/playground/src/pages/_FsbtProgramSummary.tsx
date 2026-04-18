import { useMemo } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, hierarchy, cellRenderers } from '@better-grid/plugins';
import { gantt } from '@better-grid/pro';
import { FSBT_PROGRAM_ROWS, formatMonYY, columnToDate, type FsbtProgramRow } from './_fsbt-program-data';

/**
 * Read-only program summary used at the top of FsbtCost / FsbtRevenue —
 * mirrors the Wiseway feasibility layout where each tab shows the program
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
      id: 'collapse', header: '', width: 40, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as FsbtProgramRow;
        container.style.backgroundColor = row.parentId === null ? '#F8F8F8' : '';
      },
    },
    {
      id: 'code', accessorKey: 'code', header: 'Code', width: 55, align: 'right' as const, editable: false,
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
      id: 'name', accessorKey: 'name', header: 'Phase', width: 240, editable: false,
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
      id: 'duration', accessorKey: 'duration', header: 'Duration (months)', width: 110, align: 'center' as const, editable: false,
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
      id: 'start', accessorKey: 'start', header: 'Start', width: 90, editable: false,
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
      id: 'end', accessorKey: 'end', header: 'End', width: 90, editable: false,
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
    ...ts.columns,
  ], [ts]);

  const plugins = useMemo(() => [
    formatting({ locale: 'en-AU', dateFormat: 'month-year' }),
    hierarchy({ toggleColumn: 'collapse', toggleStyle: 'chevron' }),
    cellRenderers(),
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
    }),
  ], []);

  const { containerRef } = useGrid<FsbtProgramRow>({
    data: FSBT_PROGRAM_ROWS,
    columns,
    plugins,
    frozenLeftColumns: 6,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    hierarchy: {
      getRowId: (row: FsbtProgramRow) => row.id,
      getParentId: (row: FsbtProgramRow) => row.parentId,
      defaultExpanded: true,
    },
    headerHeight: 40,
    rowHeight: 40,
  });

  return (
    <div
      ref={containerRef}
      style={{
        height: 320,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
      }}
    />
  );
}
