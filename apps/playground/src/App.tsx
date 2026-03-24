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
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 200,
          background: '#f8f9fa',
          borderRight: '1px solid #e0e0e0',
          padding: '12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflowY: 'auto',
        }}
      >
        {/* Back to landing */}
        <button
          onClick={() => setView('landing')}
          style={{
            padding: '6px 8px',
            border: 'none',
            borderRadius: 6,
            background: 'transparent',
            color: '#1a73e8',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          ← Overview
        </button>

        <h2 style={{ fontSize: 16, margin: '0 0 12px', paddingLeft: 8 }}>Demos</h2>

        <SectionLabel>Showcase</SectionLabel>
        <NavButton active={page === 'financial'} onClick={() => setPage('financial')} sub="Multi-header P&L">
          Financial Grid
        </NavButton>
        <NavButton active={page === 'task-tracker'} onClick={() => setPage('task-tracker')} sub="Status badges, progress">
          Task Tracker
        </NavButton>

        <SectionLabel>Interactive</SectionLabel>
        <NavButton active={page === 'toggle'} onClick={() => setPage('toggle')} sub="Toggle plugins on/off">
          Plugin Toggle ✨
        </NavButton>
        <NavButton active={page === 'perf'} onClick={() => setPage('perf')} sub="Up to 10M cells, live FPS">
          Performance
        </NavButton>

        <SectionLabel>Features</SectionLabel>
        <NavButton active={page === 'format-edit'} onClick={() => setPage('format-edit')} sub="Currency, dates, dropdowns">
          Format & Edit
        </NavButton>
        <NavButton active={page === 'sort-filter'} onClick={() => setPage('sort-filter')} sub="Click headers, right-click menu">
          Sort & Filter
        </NavButton>
        <NavButton active={page === 'validation'} onClick={() => setPage('validation')} sub="Required, rules, error states">
          Validation
        </NavButton>
        <NavButton active={page === 'editor-ref'} onClick={() => setPage('editor-ref')} sub="All 12 editor types">
          Editor Reference
        </NavButton>

        <SectionLabel>Architecture</SectionLabel>
        <NavButton active={page === 'core'} onClick={() => setPage('core')} sub="Zero plugins, raw grid">
          Core Only
        </NavButton>
        <NavButton active={page === 'multi-header'} onClick={() => setPage('multi-header')} sub="Grouped columns, core feature">
          Multi-Header
        </NavButton>

        <SectionLabel>Pro</SectionLabel>
        <NavButton active={page === 'pro'} onClick={() => setPage('pro')} sub="8 plugins planned">
          Coming Soon
        </NavButton>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
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
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#aaa',
      marginTop: 14, marginBottom: 4, paddingLeft: 8, letterSpacing: '0.5px',
    }}>
      {children}
    </div>
  );
}

function NavButton({ active, onClick, children, sub }: {
  active: boolean; onClick: () => void; children: React.ReactNode; sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 8px', border: 'none', borderRadius: 6,
        background: active ? '#1a73e8' : 'transparent',
        color: active ? '#fff' : '#333',
        cursor: 'pointer', textAlign: 'left', fontSize: 13,
        lineHeight: 1.3, display: 'flex', flexDirection: 'column',
      }}
    >
      <span style={{ fontWeight: active ? 500 : 400 }}>{children}</span>
      {sub && <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.7)' : '#aaa', marginTop: 1 }}>{sub}</span>}
    </button>
  );
}
