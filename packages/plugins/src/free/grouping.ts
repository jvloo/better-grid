// ============================================================================
// Grouping Plugin — Row grouping with aggregation
// ============================================================================

import type { GridPlugin, PluginContext, ColumnDef, CellRenderContext } from '@better-grid/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Built-in aggregation function names */
export type BuiltinAggregation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';

/** Custom aggregation: receives child rows, returns aggregated value */
export type CustomAggregationFn<TData = unknown> = (children: TData[]) => unknown;

/** Aggregation specification per column */
export type AggregationSpec<TData = unknown> = BuiltinAggregation | CustomAggregationFn<TData>;

export interface GroupingOptions<TData = unknown> {
  /** Columns to group by (ordered: first = outermost group) */
  groupBy?: string[];
  /** Aggregation per column: column id -> built-in name or custom function */
  aggregations?: Record<string, AggregationSpec<TData>>;
  /** Auto-generate the group column with expand/collapse toggle. Default: true */
  autoGroupColumn?: boolean;
  /** Custom header for auto-generated group column. Default: 'Group' */
  groupColumnHeader?: string;
  /** Width of auto-generated group column. Default: 200 */
  groupColumnWidth?: number;
  /** Pixels of indent per group depth level. Default: 20 */
  indentSize?: number;
  /** Custom expand icon (collapsed state). Default: '\u25b8' */
  expandIcon?: string;
  /** Custom collapse icon (expanded state). Default: '\u25be' */
  collapseIcon?: string;
  /** Whether groups start expanded. Default: true */
  defaultExpanded?: boolean;
  /** Callback when groupBy changes */
  onGroupByChange?: (groupBy: string[]) => void;
}

export interface GroupingApi {
  setGroupBy(columns: string[]): void;
  getGroupBy(): string[];
  addGroupBy(column: string): void;
  removeGroupBy(column: string): void;
  expandGroup(groupId: string): void;
  collapseGroup(groupId: string): void;
  expandAll(): void;
  collapseAll(): void;
  isGroupRow(rowIndex: number): boolean;
  getGroupInfo(rowIndex: number): GroupRowInfo | null;
}

/** Metadata attached to synthetic group header rows */
export interface GroupRowInfo {
  /** Unique id for this group node (path-based, e.g. "category:Electronics") */
  groupId: string;
  /** The column id this group level groups by */
  groupColumnId: string;
  /** The value of the group key */
  groupValue: unknown;
  /** Depth level (0 = outermost) */
  depth: number;
  /** Whether the group is expanded */
  expanded: boolean;
  /** Number of leaf (data) rows in this group (recursive) */
  leafCount: number;
  /** Aggregated values keyed by column id */
  aggregations: Record<string, unknown>;
}

// Sentinel key to identify group rows within the flat data array
const GROUP_ROW_MARKER = '__bgGroupRow__';

/** Type guard: is this row a synthetic group header row? */
function isGroupRow(row: unknown): row is Record<string, unknown> & { [GROUP_ROW_MARKER]: GroupRowInfo } {
  return row != null && typeof row === 'object' && GROUP_ROW_MARKER in (row as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Built-in aggregation functions
// ---------------------------------------------------------------------------

function getColumnValue(row: unknown, columnId: string, columns: ColumnDef[]): unknown {
  const col = columns.find(c => c.id === columnId);
  if (!col) return undefined;
  if (col.valueGetter) return col.valueGetter(row, 0);
  if (col.field) return (row as Record<string, unknown>)[col.field];
  return (row as Record<string, unknown>)[columnId];
}

function computeBuiltinAggregation(
  name: BuiltinAggregation,
  children: unknown[],
  columnId: string,
  columns: ColumnDef[],
): unknown {
  const values = children.map(r => getColumnValue(r, columnId, columns));
  const nums = values.filter((v): v is number => typeof v === 'number' && !isNaN(v));

  switch (name) {
    case 'sum':
      return nums.reduce((s, v) => s + v, 0);
    case 'avg':
      return nums.length > 0 ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
    case 'count':
      return children.length;
    case 'min':
      return nums.length > 0 ? Math.min(...nums) : undefined;
    case 'max':
      return nums.length > 0 ? Math.max(...nums) : undefined;
    case 'first':
      return values.length > 0 ? values[0] : undefined;
    case 'last':
      return values.length > 0 ? values[values.length - 1] : undefined;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Group tree building
// ---------------------------------------------------------------------------

interface GroupNode {
  groupId: string;
  groupColumnId: string;
  groupValue: unknown;
  depth: number;
  children: unknown[];      // leaf data rows (recursive)
  childGroups: GroupNode[];  // sub-groups
}

function buildGroupTree(
  data: unknown[],
  groupBy: string[],
  columns: ColumnDef[],
  depth: number = 0,
  parentPath: string = '',
): GroupNode[] {
  if (depth >= groupBy.length) return [];

  const columnId = groupBy[depth]!;
  const groups = new Map<string, { value: unknown; rows: unknown[] }>();

  for (const row of data) {
    const rawValue = getColumnValue(row, columnId, columns);
    const key = rawValue == null ? '__null__' : String(rawValue);
    let group = groups.get(key);
    if (!group) {
      group = { value: rawValue, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  const nodes: GroupNode[] = [];
  for (const [key, group] of groups) {
    const groupId = parentPath ? `${parentPath}|${columnId}:${key}` : `${columnId}:${key}`;
    const node: GroupNode = {
      groupId,
      groupColumnId: columnId,
      groupValue: group.value,
      depth,
      children: group.rows,
      childGroups: buildGroupTree(group.rows, groupBy, columns, depth + 1, groupId),
    };
    nodes.push(node);
  }

  return nodes;
}

/** Flatten the group tree into a display-order array with group header rows interspersed */
function flattenGroupTree(
  nodes: GroupNode[],
  expandedGroups: Set<string>,
  aggregations: Record<string, AggregationSpec>,
  columns: ColumnDef[],
  groupBy: string[],
): unknown[] {
  const result: unknown[] = [];

  for (const node of nodes) {
    // Compute aggregations for this group
    const aggValues: Record<string, unknown> = {};
    for (const [colId, spec] of Object.entries(aggregations)) {
      if (typeof spec === 'function') {
        aggValues[colId] = spec(node.children);
      } else {
        aggValues[colId] = computeBuiltinAggregation(spec, node.children, colId, columns);
      }
    }

    const info: GroupRowInfo = {
      groupId: node.groupId,
      groupColumnId: node.groupColumnId,
      groupValue: node.groupValue,
      depth: node.depth,
      expanded: expandedGroups.has(node.groupId),
      leafCount: node.children.length,
      aggregations: aggValues,
    };

    // Create synthetic group row that carries the marker + aggregated values
    // Spread aggregated values as top-level keys so cell renderers can access them
    const groupRow: Record<string, unknown> = {
      [GROUP_ROW_MARKER]: info,
      ...aggValues,
    };

    // Also set the group column's value to the groupValue for display
    const groupCol = columns.find(c => c.id === node.groupColumnId);
    if (groupCol?.field) {
      groupRow[groupCol.field] = node.groupValue;
    }
    groupRow[node.groupColumnId] = node.groupValue;

    result.push(groupRow);

    if (info.expanded) {
      if (node.childGroups.length > 0) {
        // Has sub-groups — recurse
        const childRows = flattenGroupTree(node.childGroups, expandedGroups, aggregations, columns, groupBy);
        result.push(...childRows);
      } else {
        // Leaf group — add data rows
        result.push(...node.children);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export function grouping<TData = unknown>(options?: GroupingOptions<TData>): GridPlugin<'grouping', GroupingApi> {
  const indentSize = options?.indentSize ?? 20;
  const expandIcon = options?.expandIcon ?? '\u25b8';
  const collapseIcon = options?.collapseIcon ?? '\u25be';
  const defaultExpanded = options?.defaultExpanded ?? true;

  return {
    id: 'grouping',

    init(ctx: PluginContext) {
      const store = ctx.store;
      const grid = ctx.grid;

      // ── Mutable state ──
      let groupByColumns: string[] = options?.groupBy ? [...options.groupBy] : [];
      const aggregations: Record<string, AggregationSpec<unknown>> = options?.aggregations
        ? { ...options.aggregations as Record<string, AggregationSpec<unknown>> }
        : {};
      let expandedGroups = new Set<string>();
      /** Original ungrouped data (saved before first grouping transform) */
      let originalData: unknown[] | null = null;
      /** Map from display row index -> GroupRowInfo for group header rows */
      let groupRowMap = new Map<number, GroupRowInfo>();
      /** Auto-generated group column definition (if enabled) */
      let autoGroupColDef: ColumnDef | null = null;
      /** Whether the auto group column is currently injected */
      let autoGroupColInjected = false;

      // ── Helpers ──

      function collectAllGroupIds(nodes: GroupNode[]): string[] {
        const ids: string[] = [];
        for (const node of nodes) {
          ids.push(node.groupId);
          if (node.childGroups.length > 0) {
            ids.push(...collectAllGroupIds(node.childGroups));
          }
        }
        return ids;
      }

      function applyGrouping(): void {
        const currentData = grid.getData();

        // Save original data on first grouping pass
        if (!originalData) {
          originalData = [...currentData];
        }

        if (groupByColumns.length === 0) {
          // No grouping — restore original data
          if (originalData) {
            grid.setData(originalData as TData[]);
            originalData = null;
          }
          groupRowMap.clear();
          removeAutoGroupColumn();
          return;
        }

        const columns = store.getState().columns;
        const tree = buildGroupTree(originalData, groupByColumns, columns);

        // If defaultExpanded and this is initial grouping, expand all groups
        if (defaultExpanded && expandedGroups.size === 0) {
          const allIds = collectAllGroupIds(tree);
          expandedGroups = new Set(allIds);
        }

        const flatData = flattenGroupTree(tree, expandedGroups, aggregations, columns, groupByColumns);

        // Build group row index map
        groupRowMap.clear();
        for (let i = 0; i < flatData.length; i++) {
          const row = flatData[i];
          if (isGroupRow(row)) {
            groupRowMap.set(i, row[GROUP_ROW_MARKER]);
          }
        }

        // Inject auto group column if needed
        if ((options?.autoGroupColumn ?? true) && !autoGroupColInjected) {
          injectAutoGroupColumn();
        }

        grid.setData(flatData as TData[]);
      }

      // ── Auto group column ──

      function injectAutoGroupColumn(): void {
        if (autoGroupColInjected) return;

        const columns = store.getState().columns;
        autoGroupColDef = {
          id: '__bg_group__',
          header: options?.groupColumnHeader ?? 'Group',
          width: options?.groupColumnWidth ?? 200,
          resizable: true,
          editable: false,
          sortable: false,
          cellRenderer: groupCellRenderer,
        };

        // Insert at position 0
        store.update('columns', () => ({
          columns: [autoGroupColDef!, ...columns] as ColumnDef[],
          columnWidths: [autoGroupColDef!.width ?? 200, ...store.getState().columnWidths],
        }));
        autoGroupColInjected = true;
      }

      function removeAutoGroupColumn(): void {
        if (!autoGroupColInjected) return;

        const columns = store.getState().columns;
        const widths = store.getState().columnWidths;
        const idx = columns.findIndex(c => c.id === '__bg_group__');
        if (idx >= 0) {
          const newCols = [...columns];
          const newWidths = [...widths];
          newCols.splice(idx, 1);
          newWidths.splice(idx, 1);
          store.update('columns', () => ({
            columns: newCols as ColumnDef[],
            columnWidths: newWidths,
          }));
        }
        autoGroupColInjected = false;
        autoGroupColDef = null;
      }

      // ── Group cell renderer ──

      function groupCellRenderer(container: HTMLElement, context: CellRenderContext): void {
        container.textContent = '';

        const row = context.row;
        if (!isGroupRow(row)) {
          // Data row in group column — show nothing or indent
          return;
        }

        const info = row[GROUP_ROW_MARKER];
        const basePadding = 8;
        container.style.paddingLeft = `${basePadding + info.depth * indentSize}px`;
        container.style.fontWeight = '600';

        // Add CSS classes for styling hooks
        container.classList.add('bg-cell--group-header');
        container.classList.toggle('bg-cell--expanded', info.expanded);
        container.classList.toggle('bg-cell--collapsed', !info.expanded);

        // Toggle icon
        const toggle = document.createElement('span');
        toggle.className = 'bg-grouping-toggle';
        toggle.textContent = info.expanded ? collapseIcon : expandIcon;
        toggle.style.cursor = 'pointer';
        toggle.style.marginRight = '6px';
        toggle.style.userSelect = 'none';
        toggle.style.display = 'inline-block';
        toggle.style.width = '12px';
        toggle.style.textAlign = 'center';
        toggle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleGroup(info.groupId);
        });
        container.appendChild(toggle);

        // Group label: "value (count)"
        const label = document.createElement('span');
        label.className = 'bg-grouping-label';
        const displayValue = info.groupValue != null ? String(info.groupValue) : '(empty)';
        label.textContent = `${displayValue} (${info.leafCount})`;
        container.appendChild(label);
      }

      // ── Toggle / expand / collapse ──

      function toggleGroup(groupId: string): void {
        if (expandedGroups.has(groupId)) {
          expandedGroups.delete(groupId);
        } else {
          expandedGroups.add(groupId);
        }
        applyGrouping();
      }

      function expandGroup(groupId: string): void {
        if (!expandedGroups.has(groupId)) {
          expandedGroups.add(groupId);
          applyGrouping();
        }
      }

      function collapseGroup(groupId: string): void {
        if (expandedGroups.has(groupId)) {
          expandedGroups.delete(groupId);
          applyGrouping();
        }
      }

      function expandAll(): void {
        if (!originalData) return;
        const columns = store.getState().columns;
        const tree = buildGroupTree(originalData, groupByColumns, columns);
        const allIds = collectAllGroupIds(tree);
        expandedGroups = new Set(allIds);
        applyGrouping();
      }

      function collapseAll(): void {
        expandedGroups.clear();
        applyGrouping();
      }

      // ── Key bindings ──

      const unregArrowRight = ctx.registerKeyBinding({
        key: 'ArrowRight',
        priority: 5,
        handler: (_event, activeCell) => {
          if (!activeCell) return false;
          const info = groupRowMap.get(activeCell.rowIndex);
          if (info && !info.expanded) {
            toggleGroup(info.groupId);
            return true;
          }
          return false;
        },
      });

      const unregArrowLeft = ctx.registerKeyBinding({
        key: 'ArrowLeft',
        priority: 5,
        handler: (_event, activeCell) => {
          if (!activeCell) return false;
          const info = groupRowMap.get(activeCell.rowIndex);
          if (info && info.expanded) {
            toggleGroup(info.groupId);
            return true;
          }
          return false;
        },
      });

      // ── Public API ──

      const api: GroupingApi = {
        setGroupBy(columns: string[]): void {
          groupByColumns = [...columns];
          // Reset expanded state for fresh grouping
          expandedGroups.clear();
          applyGrouping();
          options?.onGroupByChange?.(groupByColumns);
        },
        getGroupBy(): string[] {
          return [...groupByColumns];
        },
        addGroupBy(column: string): void {
          if (!groupByColumns.includes(column)) {
            groupByColumns.push(column);
            applyGrouping();
            options?.onGroupByChange?.(groupByColumns);
          }
        },
        removeGroupBy(column: string): void {
          const idx = groupByColumns.indexOf(column);
          if (idx >= 0) {
            groupByColumns.splice(idx, 1);
            applyGrouping();
            options?.onGroupByChange?.(groupByColumns);
          }
        },
        expandGroup,
        collapseGroup,
        expandAll,
        collapseAll,
        isGroupRow(rowIndex: number): boolean {
          return groupRowMap.has(rowIndex);
        },
        getGroupInfo(rowIndex: number): GroupRowInfo | null {
          return groupRowMap.get(rowIndex) ?? null;
        },
      };

      ctx.expose(api);

      // ── Apply initial grouping ──

      if (groupByColumns.length > 0) {
        // Defer to after mount so columns/data are ready
        setTimeout(() => applyGrouping(), 0);
      }

      // ── Listen for data changes to re-apply grouping ──

      const unsubData = store.subscribe('data', () => {
        // Avoid re-entrancy: only re-group if the data change came from outside
        // (i.e., not from our own applyGrouping call)
        // We detect this by checking if originalData is set and the new data
        // does not contain group markers (meaning external reset)
        if (originalData && groupByColumns.length > 0) {
          const data = store.getState().data;
          if (data.length > 0 && !isGroupRow(data[0]) && !data.some(r => isGroupRow(r))) {
            // External data update — re-save and re-group
            originalData = [...data];
            applyGrouping();
          }
        }
      });

      return () => {
        unregArrowRight();
        unregArrowLeft();
        unsubData();
        removeAutoGroupColumn();
      };
    },
  };
}
