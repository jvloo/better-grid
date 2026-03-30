import '@better-grid/core/styles.css';

export function ProPreview() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Pro Plugins — Coming Soon</h1>
      <p style={{ marginBottom: 24, color: '#666', lineHeight: 1.5 }}>
        Premium plugins for enterprise use cases. Commercial license.
      </p>

      <div style={{ marginBottom: 24, padding: 16, background: '#f0fff4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#166534' }}>Already Free (MIT)</h3>
        <p style={{ margin: 0, color: '#15803d', lineHeight: 1.5 }}>
          These features are included in the free tier: <code>hierarchy()</code> — tree data with collapse/expand,
          <code>clipboard()</code> — Ctrl+C/V/X copy/paste,
          <code>editing()</code> — text, number, date, dropdown, autocomplete editors.
          Pro plugins build on top of these with advanced capabilities.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        <PluginCard
          name="clipboard() pro"
          description="Fill-down (Ctrl+D), fill-series, Excel-rich paste format. Basic copy/paste is free."
          status="Planned"
        />
        <PluginCard
          name="grouping()"
          description="Auto-group rows by column values. Built-in aggregation (sum, avg, count, min, max). Multi-level grouping. Note: Basic tree data with collapse/expand is free via hierarchy()."
          status="Planned"
        />
        <PluginCard
          name="undoRedo()"
          description="Ctrl+Z undo, Ctrl+Y redo. Tracks all cell edits, sort changes, and filter operations."
          status="Planned"
        />
        <PluginCard
          name="export()"
          description="Export grid data to CSV, Excel (.xlsx), PDF, or PNG. Respects formatting, frozen columns, and hidden rows."
          status="Planned"
        />
        <PluginCard
          name="columnVisibility()"
          description="Show/hide columns via UI. Column chooser panel. Persist visibility state."
          status="Planned"
        />
        <PluginCard
          name="rowVisibility()"
          description="Show/hide rows programmatically or via UI. Row filtering by visibility state."
          status="Planned"
        />
        <PluginCard
          name="search()"
          description="Find & highlight text across all cells. Ctrl+F shortcut. Navigate between matches."
          status="Planned"
        />
        <PluginCard
          name="formulas()"
          description="Spreadsheet formulas: =SUM, =AVERAGE, =IF, =VLOOKUP, cell references (A1:B5). Formula bar."
          status="Planned"
        />
      </div>

      <div style={{ marginTop: 32, padding: 16, background: '#f0f7ff', borderRadius: 8, border: '1px solid #d0e0f0' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>AI Integration (Future)</h3>
        <p style={{ margin: 0, color: '#555', lineHeight: 1.5 }}>
          <strong>MCP Server</strong> — AI-assisted column config generation, schema inference, migration tooling from other grids.
          <br />
          <strong>AI Plugin</strong> — Free NL filtering ("show costs over $50k from Q1"), plus pro-tier data summarization, anomaly detection, smart suggestions.
        </p>
      </div>
    </div>
  );
}

function PluginCard({ name, description, status }: { name: string; description: string; status: string }) {
  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <code style={{ fontSize: 14, fontWeight: 600, color: '#1a73e8' }}>{name}</code>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 12,
            background: '#f0f0f0',
            color: '#888',
          }}
        >
          {status}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}
