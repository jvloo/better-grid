import type { Transform, JSCodeshift } from 'jscodeshift';

const KEY_RENAMES: Record<string, string> = {
  name: 'headerName',
  rows: 'data',
  onRowsChange: 'onCellChange',
};

const SUMMARY_RENAMES: Record<string, string> = {
  summaryRows: 'pinned.bottom',
  topSummaryRows: 'pinned.top',
};

function addFlag(j: JSCodeshift, node: { comments?: unknown[] }, reason: string): void {
  const comment = j.commentLine(` @better-grid/migrate: review — ${reason}`, true, false);
  node.comments = [...(node.comments ?? []), comment as unknown as object];
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Object-literal property renames
  root.find(j.Property).forEach((p) => {
    if (p.node.key.type !== 'Identifier') return;
    const name = (p.node.key as { name: string }).name;

    // key:'amount' (column-level RDG colId) → field:'amount' + id:'amount'
    if (name === 'key') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'string') {
        (p.node.key as { name: string }).name = 'field';
        // We don't insert a separate id property here — Better Grid auto-derives id from field.
      }
      return;
    }

    if (name === 'formatter') {
      addFlag(j, p.node, 'formatter ({ row, column }) → cellRenderer (container, ctx) — DOM port required');
      (p.node.key as { name: string }).name = 'cellRenderer';
      return;
    }

    if (name === 'editor') {
      addFlag(j, p.node, 'editor (TextEditor/DropDownEditor component) → cellEditor: text|select|... (string)');
      (p.node.key as { name: string }).name = 'cellEditor';
      return;
    }

    if (name === 'editorOptions') {
      addFlag(j, p.node, 'editorOptions: { editOnClick } → features: { edit: { editTrigger: \'click\' } } (configure on grid root)');
      return;
    }

    // Per-column frozen:true → flag (Better Grid uses grid-level frozen.left counter)
    if (name === 'frozen') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'boolean' && v.value === true) {
        addFlag(j, p.node, "per-column frozen:true → grid-level frozen: { left: N } (count from left)");
        return;
      }
    }

    if (name === 'headerCellClass') {
      addFlag(j, p.node, 'headerCellClass → not yet supported per-column in Better Grid (open an issue)');
      return;
    }

    if (SUMMARY_RENAMES[name]) {
      addFlag(j, p.node, `'${name}' -> '${SUMMARY_RENAMES[name]}' (nested rename — needs object grouping)`);
      return;
    }

    if (KEY_RENAMES[name]) {
      (p.node.key as { name: string }).name = KEY_RENAMES[name];
      return;
    }
  });

  // JSX attribute renames (rowKeyGetter → top-level getRowId; selectedRows/onSelectedRowsChange flag)
  root.find(j.JSXAttribute).forEach((p) => {
    const nameNode = p.node.name as { name?: string };
    const name = nameNode.name;
    if (!name) return;
    if (name === 'rowKeyGetter') {
      nameNode.name = 'getRowId';
      return;
    }
    if (name === 'selectedRows') {
      addFlag(j, p.node, 'selectedRows + onSelectedRowsChange → selection: { mode: \'row\', multiRange: true } + onSelectionChange');
      return;
    }
    if (name === 'onSelectedRowsChange') {
      nameNode.name = 'onSelectionChange';
      return;
    }
    if (KEY_RENAMES[name]) {
      nameNode.name = KEY_RENAMES[name];
    }
  });

  return root.toSource({ quote: 'single' });
};

export default transform;
