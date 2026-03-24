import { useState } from 'react';
import { Landing } from './pages/Landing';
import { ComplexGrid } from './pages/ComplexGrid';
import { TaskTracker } from './pages/TaskTracker';
import { PluginToggle } from './pages/PluginToggle';
import { LargeDataset } from './pages/LargeDataset';
import { FormatEdit } from './pages/FormatEdit';
import { SortFilter } from './pages/SortFilter';
import { ValidationDemo } from './pages/ValidationDemo';
import { EditableGrid } from './pages/EditableGrid';
import { CoreOnly } from './pages/CoreOnly';
import { MultiHeader } from './pages/MultiHeader';
import { ProPreview } from './pages/ProPreview';

type View = 'landing' | 'demos';
type Page = 'financial' | 'task-tracker' | 'toggle' | 'perf' | 'format-edit' | 'sort-filter' | 'validation' | 'editor-ref' | 'core' | 'multi-header' | 'pro';

export function App() {
  const [view, setView] = useState<View>('landing');
  const [page, setPage] = useState<Page>('financial');

  if (view === 'landing') {
    return <Landing onExploreDemos={() => setView('demos')} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fafbfc' }}>
      {/* Sidebar — dark, matching landing aesthetic */}
      <nav style={{
        width: 240,
        background: '#0f0f0f',
        borderRight: '1px solid #1a1a1a',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        color: '#ccc',
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Better Grid</span>
          <button
            onClick={() => setView('landing')}
            style={{
              padding: '4px 10px', border: '1px solid #333', borderRadius: 6,
              background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 12,
            }}
          >
            ← Home
          </button>
        </div>

        <div style={{ padding: '12px 12px', flex: 1 }}>
          <SectionLabel>Showcase</SectionLabel>
          <NavButton active={page === 'financial'} onClick={() => setPage('financial')} icon="📊" sub="Multi-header P&L">
            Financial Grid
          </NavButton>
          <NavButton active={page === 'task-tracker'} onClick={() => setPage('task-tracker')} icon="✅" sub="Status badges, progress">
            Task Tracker
          </NavButton>

          <SectionLabel>Interactive</SectionLabel>
          <NavButton active={page === 'toggle'} onClick={() => setPage('toggle')} icon="🔌" sub="Enable/disable plugins live">
            Plugin Toggle
          </NavButton>
          <NavButton active={page === 'perf'} onClick={() => setPage('perf')} icon="⚡" sub="Up to 10M cells, live FPS">
            Performance
          </NavButton>

          <SectionLabel>Features</SectionLabel>
          <NavButton active={page === 'format-edit'} onClick={() => setPage('format-edit')} icon="✏️" sub="Currency, dates, dropdowns">
            Format & Edit
          </NavButton>
          <NavButton active={page === 'sort-filter'} onClick={() => setPage('sort-filter')} icon="🔽" sub="Header click, context menu">
            Sort & Filter
          </NavButton>
          <NavButton active={page === 'validation'} onClick={() => setPage('validation')} icon="🛡️" sub="Required, rules, errors">
            Validation
          </NavButton>
          <NavButton active={page === 'editor-ref'} onClick={() => setPage('editor-ref')} icon="🧪" sub="All 12 editor types">
            Editor Reference
          </NavButton>

          <SectionLabel>Architecture</SectionLabel>
          <NavButton active={page === 'core'} onClick={() => setPage('core')} icon="🧱" sub="Zero plugins, raw values">
            Core Only
          </NavButton>
          <NavButton active={page === 'multi-header'} onClick={() => setPage('multi-header')} icon="📋" sub="Grouped columns">
            Multi-Header
          </NavButton>

          <SectionLabel>Pro</SectionLabel>
          <NavButton active={page === 'pro'} onClick={() => setPage('pro')} icon="💎" sub="8 plugins planned">
            Coming Soon
          </NavButton>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #1a1a1a', fontSize: 11, color: '#555' }}>
          v0.0.1 &bull; MIT License
        </div>
      </nav>

      {/* Content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '28px 32px',
      }}>
        <div style={{ maxWidth: 1400 }}>
          {page === 'financial' && <ComplexGrid />}
          {page === 'task-tracker' && <TaskTracker />}
          {page === 'toggle' && <PluginToggle />}
          {page === 'perf' && <LargeDataset />}
          {page === 'format-edit' && <FormatEdit />}
          {page === 'sort-filter' && <SortFilter />}
          {page === 'validation' && <ValidationDemo />}
          {page === 'editor-ref' && <EditableGrid />}
          {page === 'core' && <CoreOnly />}
          {page === 'multi-header' && <MultiHeader />}
          {page === 'pro' && <ProPreview />}
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#555',
      marginTop: 20, marginBottom: 6, paddingLeft: 10, letterSpacing: '1px',
    }}>
      {children}
    </div>
  );
}

function NavButton({ active, onClick, children, sub, icon }: {
  active: boolean; onClick: () => void; children: React.ReactNode; sub?: string; icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '8px 10px',
        border: 'none',
        borderRadius: 8,
        background: active
          ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15))'
          : 'transparent',
        borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
        color: active ? '#fff' : '#999',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        lineHeight: 1.3,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 2,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon && <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>}
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: active ? 600 : 400 }}>{children}</span>
        {sub && <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.5)' : '#555', marginTop: 2 }}>{sub}</span>}
      </span>
    </button>
  );
}
