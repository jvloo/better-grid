import type { Transform, JSCodeshift } from 'jscodeshift';

const EDITOR_RENAMES: Record<string, string> = {
  agTextCellEditor: 'text',
  agSelectCellEditor: 'select',
  agNumberCellEditor: 'number',
  agDateCellEditor: 'date',
};

const OPTIONS_RENAMES: Record<string, string> = {
  rowData: 'data',
  columnDefs: 'columns',
  onCellValueChanged: 'onCellChange',
  onSelectionChanged: 'onSelectionChange',
};

const NESTED_RENAMES: Record<string, string> = {
  pinnedTopRowData: 'pinned.top',
  pinnedBottomRowData: 'pinned.bottom',
};

function addFlag(j: JSCodeshift, node: { comments?: unknown[] }, reason: string): void {
  const comment = j.commentLine(` @better-grid/migrate: review — ${reason}`, true, false);
  node.comments = [...(node.comments ?? []), comment as unknown as object];
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // 1) cellEditor string-literal renames
  root
    .find(j.Property, { key: { name: 'cellEditor' } })
    .forEach((p) => {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'string' && EDITOR_RENAMES[v.value as string]) {
        v.value = EDITOR_RENAMES[v.value as string];
      }
    });

  // 2) cellEditorParams: { values: [...] } → options: [...]
  root
    .find(j.Property, { key: { name: 'cellEditorParams' } })
    .forEach((p) => {
      const v = p.node.value as { type: string; properties?: Array<{ type: string; key?: { name?: string }; value?: unknown }> };
      if (v.type !== 'ObjectExpression' || !v.properties) return;
      const valuesProp = v.properties.find(
        (q) => (q.type === 'Property' || q.type === 'ObjectProperty') && q.key?.name === 'values',
      );
      if (valuesProp?.value) {
        p.replace(
          j.property('init', j.identifier('options'), valuesProp.value as never),
        );
      }
    });

  // 3) Top-level option renames in object literals
  root.find(j.Property).forEach((p) => {
    if (p.node.key.type !== 'Identifier') return;
    const name = (p.node.key as { name: string }).name;
    if (OPTIONS_RENAMES[name]) {
      (p.node.key as { name: string }).name = OPTIONS_RENAMES[name];
    } else if (NESTED_RENAMES[name]) {
      addFlag(j, p.node, `'${name}' -> '${NESTED_RENAMES[name]}' (nested rename — needs object grouping)`);
    }
  });

  // 3b) Top-level option renames in JSX attributes
  root.find(j.JSXAttribute).forEach((p) => {
    const nameNode = p.node.name as { name?: string; type?: string };
    const name = nameNode.name;
    if (!name) return;
    if (OPTIONS_RENAMES[name]) {
      nameNode.name = OPTIONS_RENAMES[name];
    } else if (NESTED_RENAMES[name]) {
      addFlag(j, p.node, `'${name}' -> '${NESTED_RENAMES[name]}' (nested rename — needs object grouping)`);
    }
  });

  // 4) cellRenderer non-literal value → flag (likely React component)
  root
    .find(j.Property, { key: { name: 'cellRenderer' } })
    .forEach((p) => {
      const v = p.node.value as { type: string };
      if (v.type !== 'Literal') {
        addFlag(j, p.node, 'cellRenderer JSX → DOM port required');
      }
    });

  // 5) ModuleRegistry calls → flag
  root
    .find(j.CallExpression)
    .forEach((p) => {
      const callee = p.node.callee as { type: string; object?: { type: string; name?: string } };
      if (
        callee.type === 'MemberExpression' &&
        callee.object?.type === 'Identifier' &&
        callee.object.name === 'ModuleRegistry'
      ) {
        addFlag(j, p.node, 'ModuleRegistry call — confirm features list');
      }
    });

  return root.toSource({ quote: 'single' });
};

export default transform;
