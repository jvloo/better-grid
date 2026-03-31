import '@better-grid/core/styles.css';

export function ProPreview() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Roadmap</h1>
      <p style={{ marginBottom: 24, color: '#666', lineHeight: 1.5 }}>
        Feature status across all tiers. Core and free plugins are MIT-licensed. Pro plugins will require a commercial license.
      </p>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Core (MIT)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Card name="Virtual Scrolling" desc="Prefix-sum O(log n) range computation, cell pooling (~200 DOM elements)" status="shipped" />
        <Card name="Frozen Columns" desc="Lock left columns outside scroll container" status="shipped" />
        <Card name="Freeze Clip" desc="Drag handle to clip frozen columns and reclaim horizontal space" status="shipped" />
        <Card name="Pinned Rows" desc="Top/bottom summary rows outside virtual scroll" status="shipped" />
        <Card name="Multi-Level Headers" desc="colSpan/rowSpan grouped headers" status="shipped" />
        <Card name="Selection" desc="Cell, row, range, multi-range (Ctrl+click)" status="shipped" />
        <Card name="Fill Handle" desc="Drag to copy values across cells (series detection is Pro)" status="shipped" />
        <Card name="Keyboard Navigation" desc="Arrow, Tab, Enter, Escape" status="shipped" />
        <Card name="Column Resize" desc="Drag column borders to resize" status="shipped" />
        <Card name="Custom Properties" desc="CSS custom properties for theming" status="shipped" />
        <Card name="Column Reorder" desc="Drag columns to reorder" status="planned" />
        <Card name="Row Height Auto" desc="Dynamic row heights based on content" status="planned" />
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Free Plugins (MIT)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Card name="editing()" desc="Text, number, date, dropdown, autocomplete editors. Float and inline modes." status="shipped" />
        <Card name="formatting()" desc="Intl-based number, currency, percent, date formatting" status="shipped" />
        <Card name="sorting()" desc="Multi-column sort with header click indicators" status="shipped" />
        <Card name="filtering()" desc="9 filter operators, context menu UI" status="shipped" />
        <Card name="validation()" desc="Required fields, custom rules, error UI" status="shipped" />
        <Card name="clipboard()" desc="Ctrl+C/V/X with type-aware paste parsing" status="shipped" />
        <Card name="hierarchy()" desc="Tree data with collapse/expand, arrow key navigation" status="shipped" />
        <Card name="cellRenderers()" desc="badge, progress, rating, boolean, change, timeline, tooltip, loading" status="shipped" />
        <Card name="undoRedo()" desc="Ctrl+Z/Y history stack with configurable depth" status="shipped" />
        <Card name="search()" desc="Ctrl+F find & highlight across all cells" status="shipped" />
        <Card name="export()" desc="CSV and Excel (.xlsx) with multi-headers, merge cells, frozen panes, dropdowns" status="shipped" />
        <Card name="pagination()" desc="Page navigation with configurable page size" status="shipped" />
        <Card name="autoDetect()" desc="Infer column types and alignment from data samples" status="shipped" />
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Pro Plugins (Commercial)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Card name="mergeCells()" desc="Body cell row/column spanning with runtime API" status="shipped" />
        <Card name="Fill Series (Pro)" desc="Ctrl+D fill down, Ctrl+R fill right, numeric/date series detection in drag handle" status="planned" />
        <Card name="grouping()" desc="Auto-group by column value, aggregation (sum/avg/count/min/max), multi-level" status="planned" />
        <Card name="formulas()" desc="=SUM, =IF, =VLOOKUP, cell references, formula bar" status="planned" />
        <Card name="columnVisibility()" desc="Show/hide columns, column chooser panel" status="planned" />
        <Card name="pivotTable()" desc="Pivot/cross-tab configuration" status="planned" />
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>AI Integration (Future)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Card name="MCP Server" desc="AI-assisted column config generation, schema inference, migration tooling" status="planned" />
        <Card name="NL Filtering (Free)" desc="Natural language filtering — 'show overdue tasks assigned to Alice'" status="planned" />
        <Card name="AI Plugin (Pro)" desc="Data summarization, anomaly detection, smart column suggestions" status="planned" />
      </div>
    </div>
  );
}

function Card({ name, desc, status }: { name: string; desc: string; status: 'shipped' | 'planned' }) {
  const isShipped = status === 'shipped';
  return (
    <div style={{
      padding: 14,
      border: `1px solid ${isShipped ? '#d0e8d0' : '#e0e0e0'}`,
      borderRadius: 8,
      background: isShipped ? '#f8fdf8' : '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: isShipped ? '#166534' : '#333' }}>{name}</span>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 12,
          background: isShipped ? '#dcfce7' : '#f0f0f0',
          color: isShipped ? '#166534' : '#888',
          fontWeight: 500,
        }}>
          {isShipped ? 'Shipped' : 'Planned'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}
