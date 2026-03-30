import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting, editing, sorting } from '@better-grid/plugins';
import { useMemo } from 'react';
import '@better-grid/core/styles.css';

// Mini financial grid for hero section
interface HeroRow {
  id: number;
  project: string;
  category: string;
  total: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
}

const heroData: HeroRow[] = [
  { id: 1, project: 'Alpha Tower', category: 'Revenue', total: 1250000, jan: 95000, feb: 102000, mar: 110000, apr: 98000, may: 105000, jun: 112000 },
  { id: 2, project: 'Alpha Tower', category: 'Cost', total: -890000, jan: -72000, feb: -74000, mar: -76000, apr: -71000, may: -73000, jun: -78000 },
  { id: 3, project: 'Beta Plaza', category: 'Revenue', total: 980000, jan: 78000, feb: 82000, mar: 85000, apr: 79000, may: 84000, jun: 88000 },
  { id: 4, project: 'Beta Plaza', category: 'Cost', total: -650000, jan: -52000, feb: -54000, mar: -56000, apr: -53000, may: -55000, jun: -57000 },
  { id: 5, project: 'Gamma Heights', category: 'Revenue', total: 2100000, jan: 170000, feb: 175000, mar: 180000, apr: 172000, may: 178000, jun: 185000 },
];

export function Landing({ onExploreDemos }: { onExploreDemos: () => void }) {
  const heroHeaders = useMemo<HeaderRow[]>(() => [
    { id: 'g', height: 28, cells: [
      { id: 'gi', content: 'Project', colSpan: 3 },
      { id: 'gs', content: 'Summary', colSpan: 1 },
      { id: 'gq1', content: 'Q1', colSpan: 3 },
      { id: 'gq2', content: 'Q2', colSpan: 3 },
    ]},
    { id: 'c', height: 28, cells: [
      { id: 'hi', content: '#', columnId: 'id' },
      { id: 'hp', content: 'Project', columnId: 'project' },
      { id: 'hc', content: 'Type', columnId: 'category' },
      { id: 'ht', content: 'Total', columnId: 'total' },
      { id: 'h1', content: 'Jan', columnId: 'jan' },
      { id: 'h2', content: 'Feb', columnId: 'feb' },
      { id: 'h3', content: 'Mar', columnId: 'mar' },
      { id: 'h4', content: 'Apr', columnId: 'apr' },
      { id: 'h5', content: 'May', columnId: 'may' },
      { id: 'h6', content: 'Jun', columnId: 'jun' },
    ]},
  ], []);

  const heroCols = useMemo<ColumnDef<HeroRow>[]>(() => [
    { id: 'id', header: '#', width: 40, editable: false },
    { id: 'project', header: 'Project', width: 120 },
    { id: 'category', header: 'Type', width: 80 },
    { id: 'total', header: 'Total', width: 110, cellType: 'currency', sortable: true },
    ...(['jan','feb','mar','apr','may','jun'] as const).map(m => ({
      id: m,
      header: m.charAt(0).toUpperCase() + m.slice(1),
      width: 90,
      cellType: 'currency' as const,
      cellRenderer: (container: HTMLElement, ctx: { value: unknown }) => {
        const val = ctx.value as number;
        container.textContent = val < 0 ? `(${Math.abs(val).toLocaleString()})` : val.toLocaleString();
        container.style.textAlign = 'right';
        container.style.color = val < 0 ? '#ff6b6b' : '';
      },
    })),
  ], []);

  const heroPlugins = useMemo(() => [
    formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
    editing({ editTrigger: 'dblclick' }),
    sorting(),
  ], []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>

      {/* ═══ Hero ═══ */}
      <section style={{ padding: '60px 48px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
          Open Source &bull; MIT License
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-1px' }}>
          The data grid built
          <br />
          <span style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            for the AI era.
          </span>
        </h1>
        <p style={{ fontSize: 20, color: '#888', maxWidth: 600, lineHeight: 1.5, margin: '0 0 32px' }}>
          Framework-agnostic, TypeScript-first data grid & spreadsheet library with composable plugin architecture.
        </p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
          <button onClick={onExploreDemos} style={{
            padding: '12px 28px', borderRadius: 8, border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
          }}>
            Explore Demos →
          </button>
          <button style={{
            padding: '12px 28px', borderRadius: 8, border: '1px solid #333', fontSize: 16, fontWeight: 500, cursor: 'pointer',
            background: 'transparent', color: '#ccc',
          }}>
            npm i @better-grid/core
          </button>
        </div>

        {/* Hero Grid */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #222', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
          <BetterGrid<HeroRow>
            columns={heroCols}
            data={heroData}
            headerRows={heroHeaders}
            frozenLeftColumns={3}
            selection={{ mode: 'range' }}
            plugins={heroPlugins}
            height={280}
          />
        </div>
        <p style={{ fontSize: 13, color: '#555', marginTop: 12, textAlign: 'center' }}>
          Live interactive grid — try clicking, sorting, double-click to edit
        </p>
      </section>

      {/* ═══ Three Pillars ═══ */}
      <section style={{ padding: '60px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: '#666', marginBottom: 32, textAlign: 'center' }}>
          Why Better Grid
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          <PillarCard
            emoji="⚡"
            title="Performance First"
            description="10M cells at 60 FPS sustained. DOM virtualization with only ~200 cell elements regardless of dataset size. Binary search on prefix-sum arrays for O(log n) scroll."
            gradient="from-blue"
          />
          <PillarCard
            emoji="🔌"
            title="Framework Agnostic"
            description="Vanilla TypeScript core with thin adapters. React today, Vue and Svelte coming. One engine, every framework. Zero lock-in."
            gradient="from-purple"
          />
          <PillarCard
            emoji="🤖"
            title="AI Ready"
            description="Composable AI plugins with free NL filtering — no $999 Enterprise paywall. Schema inference, migration tooling, and data intelligence — coming soon."
            gradient="from-pink"
          />
        </div>
      </section>

      {/* ═══ Performance Stats ═══ */}
      <section style={{ padding: '60px 48px', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 40 }}>
          Built for <span style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>scale</span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          <StatCard value="60" unit="FPS" label="Sustained scroll perf" />
          <StatCard value="10M" unit="cells" label="Handled in 1.3 seconds" />
          <StatCard value="~200" unit="cells" label="In DOM regardless of size" />
          <StatCard value="480" unit="MB" label="Heap for 10M cells" />
        </div>
        <p style={{ fontSize: 14, color: '#555', marginTop: 24 }}>
          Constant ~200 cell DOM footprint whether you have 1K or 10M cells. No lag, no blank flash.
        </p>
      </section>

      {/* ═══ Comparison ═══ */}
      <section style={{ padding: '60px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>
          How we compare
        </h2>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #222' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                <th style={{ ...thStyle, textAlign: 'left', width: '30%' }}>Feature</th>
                <th style={thStyle}>AG Grid</th>
                <th style={thStyle}>Handsontable</th>
                <th style={{ ...thStyle, background: 'rgba(59,130,246,0.1)' }}>Better Grid</th>
              </tr>
            </thead>
            <tbody>
              <CompRow feature="Free editing & validation" ag="✓ Community" hs="Non-commercial" bg="MIT (free)" />
              <CompRow feature="Free badge/progress/rating" ag="✗" hs="✗" bg="✓ (MIT)" />
              <CompRow feature="Range selection" ag="Enterprise" hs="Commercial" bg="MIT (free)" />
              <CompRow feature="Framework agnostic" ag="✓" hs="✓" bg="✓" />
              <CompRow feature="Type-safe plugin DX" ag="✗ (modules)" hs="✗ (monolithic)" bg="✓ ($Infer)" />
              <CompRow feature="TypeScript-first" ag="Partial" hs="Partial" bg="✓ Strict" />
              <CompRow feature="Free tree data / collapse" ag="Enterprise" hs="✗" bg="✓ (MIT)" />
              <CompRow feature="Free clipboard (copy/paste)" ag="Enterprise" hs="Non-commercial" bg="✓ (MIT)" />
              <CompRow feature="Free AI filtering" ag="Enterprise ($999)" hs="✗" bg="Planned (free)" />
              <CompRow feature="Core price" ag="Free" hs="$899/dev/yr" bg="Free (MIT)" />
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ Plugin Tiers ═══ */}
      <section style={{ padding: '60px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>
          Everything is a plugin
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          <TierCard
            title="Core"
            price="Free forever"
            color="#3b82f6"
            features={['Virtual scrolling (10M+ cells)', 'Frozen rows & columns', 'Pinned rows (footer/totals)', 'Multi-level headers (colSpan)', 'Cell & range selection', 'Keyboard navigation', 'Row hierarchy model', 'Column resizing', 'CSS custom properties']}
          />
          <TierCard
            title="Free Plugins"
            price="MIT License"
            color="#8b5cf6"
            featured
            features={['formatting() — currency, dates, percent', 'editing() — text, number, date, dropdown, autocomplete', 'sorting() — click headers, multi-sort', 'filtering() — 9 operators, header icon', 'validation() — required, custom rules', 'hierarchy() — tree with collapse/expand', 'clipboard() — Ctrl+C/V/X, TSV + HTML']}
          />
          <TierCard
            title="Pro Plugins"
            price="Coming Soon"
            color="#ec4899"
            features={['clipboard pro — fill-down, fill-series', 'grouping() — auto-group + aggregation', 'undoRedo() — Ctrl+Z/Y history', 'export() — CSV, Excel, PDF, PNG', 'search() — find & highlight', 'formulas() — =SUM, =IF, =VLOOKUP']}
          />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ padding: '80px 48px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>
          See it in action
        </h2>
        <p style={{ fontSize: 18, color: '#888', marginBottom: 32 }}>
          15 interactive demos across 4 categories. All running live in your browser.
        </p>
        <button onClick={onExploreDemos} style={{
          padding: '16px 40px', borderRadius: 8, border: 'none', fontSize: 18, fontWeight: 600, cursor: 'pointer',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
        }}>
          Explore All Demos →
        </button>
      </section>
    </div>
  );
}

// ─── Sub-components ───

const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'center', background: '#111', color: '#888', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle: React.CSSProperties = { padding: '10px 16px', borderBottom: '1px solid #1a1a1a', textAlign: 'center', color: '#aaa' };

function CompRow({ feature, ag, hs, bg }: { feature: string; ag: string; hs: string; bg: string }) {
  const colorize = (v: string) => {
    if (v === '✓' || v === '✓ Strict') return { color: '#22c55e', fontWeight: 600 };
    if (v === '✗') return { color: '#555' };
    if (v.includes('free') || v === 'Free (MIT)') return { color: '#22c55e', fontWeight: 600 };
    if (v.includes('$')) return { color: '#f59e0b' };
    if (v === 'Enterprise' || v === 'Commercial') return { color: '#ef4444' };
    if (v === 'Coming soon') return { color: '#60a5fa', fontStyle: 'italic' as const };
    return { color: '#aaa' };
  };

  return (
    <tr>
      <td style={{ ...tdStyle, textAlign: 'left', color: '#ddd' }}>{feature}</td>
      <td style={{ ...tdStyle, ...colorize(ag) }}>{ag}</td>
      <td style={{ ...tdStyle, ...colorize(hs) }}>{hs}</td>
      <td style={{ ...tdStyle, ...colorize(bg), background: 'rgba(59,130,246,0.05)' }}>{bg}</td>
    </tr>
  );
}

function PillarCard({ emoji, title, description, gradient }: { emoji: string; title: string; description: string; gradient: string }) {
  const gradients: Record<string, string> = {
    'from-blue': 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
    'from-purple': 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))',
    'from-pink': 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(236,72,153,0.05))',
  };
  return (
    <div style={{ padding: 28, borderRadius: 12, border: '1px solid #222', background: gradients[gradient] }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{emoji}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#fff' }}>{title}</h3>
      <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, margin: 0 }}>{description}</p>
    </div>
  );
}

function StatCard({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div style={{ padding: 24, borderRadius: 12, border: '1px solid #222', background: '#111' }}>
      <div style={{ fontSize: 40, fontWeight: 800, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>{unit}</div>
      <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>{label}</div>
    </div>
  );
}

function TierCard({ title, price, color, features, featured }: { title: string; price: string; color: string; features: string[]; featured?: boolean }) {
  return (
    <div style={{
      padding: 28,
      borderRadius: 12,
      border: featured ? `2px solid ${color}` : '1px solid #222',
      background: featured ? 'rgba(139,92,246,0.05)' : '#111',
      position: 'relative',
    }}>
      {featured && (
        <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: color, color: '#fff', padding: '2px 12px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
          MOST POPULAR
        </div>
      )}
      <h3 style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 4 }}>{title}</h3>
      <div style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>{price}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {features.map((f) => (
          <li key={f} style={{ fontSize: 14, color: '#aaa', padding: '4px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color, flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
