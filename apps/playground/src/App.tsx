import { useState, useCallback, useEffect } from 'react';
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
import { MixedHeaderDemo } from './pages/MixedHeaderDemo';
import { Benchmark } from './pages/Benchmark';
import { ProPreview } from './pages/ProPreview';

type View = 'landing' | 'demos';
type Page = 'financial' | 'task-tracker' | 'toggle' | 'perf' | 'benchmark' | 'format-edit' | 'sort-filter' | 'validation' | 'editor-ref' | 'core' | 'multi-header' | 'mixed-header' | 'pro';

const VALID_PAGES = new Set<Page>([
  'financial', 'task-tracker', 'toggle', 'perf', 'benchmark', 'format-edit', 'sort-filter',
  'validation', 'editor-ref', 'core', 'multi-header', 'mixed-header', 'pro',
]);

function parseRoute(): { view: View; page: Page } {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/demo' || path === '/demos') {
    return { view: 'demos', page: 'financial' };
  }
  if (path.startsWith('/demo/')) {
    const slug = path.slice(6) as Page;
    if (VALID_PAGES.has(slug)) {
      return { view: 'demos', page: slug };
    }
    return { view: 'demos', page: 'financial' };
  }
  return { view: 'landing', page: 'financial' };
}

export function App() {
  const initial = parseRoute();
  const [view, setView] = useState<View>(initial.view);
  const [page, setPage] = useState<Page>(initial.page);

  const navigate = useCallback((v: View, p?: Page) => {
    setView(v);
    if (p) setPage(p);
    const url = v === 'landing' ? '/' : `/demo${p ? `/${p}` : ''}`;
    window.history.pushState(null, '', url);
  }, []);

  const navigatePage = useCallback((p: Page) => {
    setPage(p);
    window.history.pushState(null, '', `/demo/${p}`);
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => {
      const route = parseRoute();
      setView(route.view);
      setPage(route.page);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (view === 'landing') {
    return <Landing onExploreDemos={() => navigate('demos', 'financial')} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fafbfc' }}>

      {/* ═══ Sidebar ═══ */}
      <nav style={{
        width: 220,
        background: '#0f0f0f',
        borderRight: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        color: '#ccc',
        flexShrink: 0,
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Better Grid</span>
          <button onClick={() => navigate('landing')} style={{
            padding: '3px 8px', border: '1px solid #333', borderRadius: 5,
            background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 11,
          }}>← Home</button>
        </div>

        <div style={{ padding: '8px 8px', flex: 1 }}>
          <SectionLabel>Showcase</SectionLabel>
          <NavButton active={page === 'financial'} onClick={() => navigatePage('financial')} icon="📊">Budget Planning</NavButton>
          <NavButton active={page === 'task-tracker'} onClick={() => navigatePage('task-tracker')} icon="✅">Task Tracker</NavButton>

          <SectionLabel>Interactive</SectionLabel>
          <NavButton active={page === 'toggle'} onClick={() => navigatePage('toggle')} icon="🔌">Plugin Toggle</NavButton>
          <NavButton active={page === 'perf'} onClick={() => navigatePage('perf')} icon="⚡">Performance</NavButton>
          <NavButton active={page === 'benchmark'} onClick={() => navigatePage('benchmark')} icon="📏">Benchmark</NavButton>

          <SectionLabel>Features</SectionLabel>
          <NavButton active={page === 'format-edit'} onClick={() => navigatePage('format-edit')} icon="✏️">Format & Edit</NavButton>
          <NavButton active={page === 'sort-filter'} onClick={() => navigatePage('sort-filter')} icon="🔽">Sort & Filter</NavButton>
          <NavButton active={page === 'validation'} onClick={() => navigatePage('validation')} icon="🛡️">Validation</NavButton>
          <NavButton active={page === 'editor-ref'} onClick={() => navigatePage('editor-ref')} icon="🧪">Editor Reference</NavButton>

          <SectionLabel>Architecture</SectionLabel>
          <NavButton active={page === 'core'} onClick={() => navigatePage('core')} icon="🧱">Core Only</NavButton>
          <NavButton active={page === 'multi-header'} onClick={() => navigatePage('multi-header')} icon="📋">Multi-Header</NavButton>
          <NavButton active={page === 'mixed-header'} onClick={() => navigatePage('mixed-header')} icon="🔀">Mixed Headers</NavButton>

          <SectionLabel>Pro</SectionLabel>
          <NavButton active={page === 'pro'} onClick={() => navigatePage('pro')} icon="💎">Coming Soon</NavButton>
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', fontSize: 10, color: '#444' }}>
          v0.0.1 &bull; MIT
        </div>
      </nav>

      {/* ═══ Content ═══ */}
      <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', minWidth: 0 }}>
        <div style={{ maxWidth: 1200 }}>
          {page === 'financial' && <ComplexGrid />}
          {page === 'task-tracker' && <TaskTracker />}
          {page === 'toggle' && <PluginToggle />}
          {page === 'perf' && <LargeDataset />}
          {page === 'benchmark' && <Benchmark />}
          {page === 'format-edit' && <FormatEdit />}
          {page === 'sort-filter' && <SortFilter />}
          {page === 'validation' && <ValidationDemo />}
          {page === 'editor-ref' && <EditableGrid />}
          {page === 'core' && <CoreOnly />}
          {page === 'multi-header' && <MultiHeader />}
          {page === 'mixed-header' && <MixedHeaderDemo />}
          {page === 'pro' && <ProPreview />}
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: '#555',
      marginTop: 16, marginBottom: 4, paddingLeft: 8, letterSpacing: '1px',
    }}>
      {children}
    </div>
  );
}

function NavButton({ active, onClick, children, icon }: {
  active: boolean; onClick: () => void; children: React.ReactNode; icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '7px 8px',
        border: 'none',
        borderRadius: 6,
        background: active ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15))' : 'transparent',
        borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
        color: active ? '#fff' : '#999',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 1,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>}
      <span style={{ fontWeight: active ? 600 : 400 }}>{children}</span>
    </button>
  );
}
