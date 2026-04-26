import { useState, useCallback, useEffect } from 'react';
import './realworld-theme.css';
import { Landing } from './pages/Landing';
import { FinanceDashboard } from './pages/FinanceDashboard';
import { ProjectTracker } from './pages/ProjectTracker';
import { EditorTypes } from './pages/EditorTypes';
import { CellTypes } from './pages/CellTypes';
import { ClipboardFill } from './pages/ClipboardFill';
import { SortFilter } from './pages/SortFilter';
import { SearchExport } from './pages/SearchExport';
import { HierarchyDemo } from './pages/HierarchyDemo';
import { FrozenPinned } from './pages/FrozenPinned';
import { MultiHeaderDemo } from './pages/MultiHeaderDemo';
import { CoreOnly } from './pages/CoreOnly';
import { PluginToggle } from './pages/PluginToggle';
import { PerformanceDemo } from './pages/PerformanceDemo';
import { ProPreview } from './pages/ProPreview';
import { HRDirectory } from './pages/HRDirectory';
import { InventoryTracker } from './pages/InventoryTracker';
import { MergeCellsDemo } from './pages/MergeCellsDemo';
import { SelectionModes } from './pages/SelectionModes';
import { TableStyles } from './pages/TableStyles';
import { AlwaysInputDemo } from './pages/AlwaysInputDemo';
import { RhfBridgeDemo } from './pages/RhfBridgeDemo';
import { FsbtProgram } from './pages/FsbtProgram';
import { FsbtCost } from './pages/FsbtCost';
import { FsbtRevenue } from './pages/FsbtRevenue';
import { DmTimeline } from './pages/DmTimeline';
import { DmForecast } from './pages/DmForecast';
import { DmActuals } from './pages/DmActuals';
import { DmSummary } from './pages/DmSummary';
import { ColumnFeaturesDemo } from './pages/ColumnFeaturesDemo';

type View = 'landing' | 'demos';
type Page =
  | 'finance'
  | 'project-tracker'
  | 'editors'
  | 'cell-types'
  | 'clipboard'
  | 'sort-filter'
  | 'search-export'
  | 'hierarchy'
  | 'frozen-pinned'
  | 'multi-header'
  | 'core-only'
  | 'plugin-toggle'
  | 'performance'
  | 'hr-directory'
  | 'inventory'
  | 'merge-cells'
  | 'selection-modes'
  | 'table-styles'
  | 'always-input'
  | 'rhf-bridge'
  | 'fsbt-program'
  | 'fsbt-cost'
  | 'fsbt-revenue'
  | 'dm-timeline'
  | 'dm-forecast'
  | 'dm-actuals'
  | 'dm-summary'
  | 'column-features'
  | 'pro';

const VALID_PAGES = new Set<Page>([
  'finance', 'project-tracker', 'hr-directory', 'inventory', 'editors', 'cell-types', 'clipboard',
  'sort-filter', 'search-export', 'hierarchy', 'frozen-pinned', 'multi-header', 'merge-cells',
  'core-only', 'plugin-toggle', 'performance', 'selection-modes', 'table-styles', 'always-input', 'rhf-bridge', 'column-features', 'pro',
  'fsbt-program', 'fsbt-cost', 'fsbt-revenue',
  'dm-timeline', 'dm-forecast', 'dm-actuals', 'dm-summary',
]);

const REALWORLD_PAGES = new Set<Page>([
  'fsbt-program', 'fsbt-cost', 'fsbt-revenue',
  'dm-timeline', 'dm-forecast', 'dm-actuals', 'dm-summary',
]);

function parseRoute(): { view: View; page: Page } {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/demo' || path === '/demos') {
    return { view: 'demos', page: 'finance' };
  }
  if (path.startsWith('/demo-realworld/')) {
    const slug = path.slice(14) as Page;
    if (REALWORLD_PAGES.has(slug)) {
      return { view: 'demos', page: slug };
    }
    return { view: 'demos', page: 'fsbt-program' };
  }
  if (path === '/demo-realworld') {
    return { view: 'demos', page: 'fsbt-program' };
  }
  if (path.startsWith('/demo/')) {
    const slug = path.slice(6) as Page;
    if (VALID_PAGES.has(slug)) {
      return { view: 'demos', page: slug };
    }
    return { view: 'demos', page: 'finance' };
  }
  return { view: 'landing', page: 'finance' };
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
    const prefix = REALWORLD_PAGES.has(p) ? '/demo-realworld' : '/demo';
    window.history.pushState(null, '', `${prefix}/${p}`);
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
    return <Landing onExploreDemos={() => navigate('demos', 'finance')} />;
  }

  const isRealworld = REALWORLD_PAGES.has(page);

  return (
    <div style={{ display: 'flex', height: '100vh', background: isRealworld ? '#fff' : '#fafbfc' }}>

      {/* ═══ Sidebar ═══ */}
      {isRealworld ? (
        <nav style={{
          width: 240,
          background: '#fff',
          borderRight: '1px solid #EAECF0',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          color: '#344054',
          flexShrink: 0,
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #EAECF0' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#101828' }}>Real-world</span>
          </div>

          <div style={{ padding: '12px 12px', flex: 1 }}>
            <WwSectionLabel>Feasibility</WwSectionLabel>
            <WwNavButton active={page === 'fsbt-program'} onClick={() => navigatePage('fsbt-program')}>Program</WwNavButton>
            <WwNavButton active={page === 'fsbt-cost'} onClick={() => navigatePage('fsbt-cost')}>Cost</WwNavButton>
            <WwNavButton active={page === 'fsbt-revenue'} onClick={() => navigatePage('fsbt-revenue')}>Revenue</WwNavButton>

            <WwSectionLabel>Development Management</WwSectionLabel>
            <WwNavButton active={page === 'dm-timeline'} onClick={() => navigatePage('dm-timeline')}>Timeline</WwNavButton>
            <WwNavButton active={page === 'dm-forecast'} onClick={() => navigatePage('dm-forecast')}>Forecast</WwNavButton>
            <WwNavButton active={page === 'dm-actuals'} onClick={() => navigatePage('dm-actuals')}>Input Actuals</WwNavButton>
            <WwNavButton active={page === 'dm-summary'} onClick={() => navigatePage('dm-summary')}>Summary</WwNavButton>
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid #EAECF0', fontSize: 11, color: '#667085' }}>
            Powered by Better Grid
          </div>
        </nav>
      ) : (
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
            <SectionLabel>Use Cases</SectionLabel>
            <NavButton active={page === 'finance'} onClick={() => navigatePage('finance')} icon="💰">Finance Dashboard</NavButton>
            <NavButton active={page === 'project-tracker'} onClick={() => navigatePage('project-tracker')} icon="📋">Project Tracker</NavButton>
            <NavButton active={page === 'hr-directory'} onClick={() => navigatePage('hr-directory')} icon="👥">HR Directory</NavButton>
            <NavButton active={page === 'inventory'} onClick={() => navigatePage('inventory')} icon="📦">Inventory Tracker</NavButton>

            <SectionLabel>Editing</SectionLabel>
            <NavButton active={page === 'editors'} onClick={() => navigatePage('editors')} icon="✏️">Editor Types</NavButton>
            <NavButton active={page === 'clipboard'} onClick={() => navigatePage('clipboard')} icon="📎">Clipboard & Fill</NavButton>
            <NavButton active={page === 'always-input'} onClick={() => navigatePage('always-input')} icon="⌨️">Always-Input Cells</NavButton>
            <NavButton active={page === 'rhf-bridge'} onClick={() => navigatePage('rhf-bridge')} icon="📝">RHF Bridge</NavButton>

            <SectionLabel>Display</SectionLabel>
            <NavButton active={page === 'cell-types'} onClick={() => navigatePage('cell-types')} icon="🎨">Cell Types</NavButton>
            <NavButton active={page === 'sort-filter'} onClick={() => navigatePage('sort-filter')} icon="🔽">Sort & Filter</NavButton>
            <NavButton active={page === 'search-export'} onClick={() => navigatePage('search-export')} icon="🔍">Search & Export</NavButton>

            <SectionLabel>Layout</SectionLabel>
            <NavButton active={page === 'hierarchy'} onClick={() => navigatePage('hierarchy')} icon="🌳">Hierarchy</NavButton>
            <NavButton active={page === 'frozen-pinned'} onClick={() => navigatePage('frozen-pinned')} icon="📌">Frozen & Pinned</NavButton>
            <NavButton active={page === 'multi-header'} onClick={() => navigatePage('multi-header')} icon="📊">Multi-Header</NavButton>
            <NavButton active={page === 'merge-cells'} onClick={() => navigatePage('merge-cells')} icon="🔗">Merge Cells</NavButton>
            <NavButton active={page === 'column-features'} onClick={() => navigatePage('column-features')} icon="🧩">Column Features</NavButton>

            <SectionLabel>Architecture</SectionLabel>
            <NavButton active={page === 'core-only'} onClick={() => navigatePage('core-only')} icon="🧱">Core Only</NavButton>
            <NavButton active={page === 'plugin-toggle'} onClick={() => navigatePage('plugin-toggle')} icon="🔌">Plugin Toggle</NavButton>
            <NavButton active={page === 'performance'} onClick={() => navigatePage('performance')} icon="⚡">Performance</NavButton>
            <NavButton active={page === 'selection-modes'} onClick={() => navigatePage('selection-modes')} icon="🎯">Selection Modes</NavButton>
            <NavButton active={page === 'table-styles'} onClick={() => navigatePage('table-styles')} icon="🎨">Table Styles</NavButton>

            <SectionLabel>Other</SectionLabel>
            <NavButton active={page === 'pro'} onClick={() => navigatePage('pro')} icon="🗺️">Roadmap</NavButton>
          </div>

          <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', fontSize: 10, color: '#444' }}>
            v0.1.0 &bull; MIT
          </div>
        </nav>
      )}

      {/* ═══ Content ═══ */}
      <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', minWidth: 0 }}>
        <div style={{ maxWidth: isRealworld ? undefined : 1200 }}>
          {page === 'finance' && <FinanceDashboard />}
          {page === 'project-tracker' && <ProjectTracker />}
          {page === 'hr-directory' && <HRDirectory />}
          {page === 'inventory' && <InventoryTracker />}
          {page === 'editors' && <EditorTypes />}
          {page === 'cell-types' && <CellTypes />}
          {page === 'clipboard' && <ClipboardFill />}
          {page === 'sort-filter' && <SortFilter />}
          {page === 'search-export' && <SearchExport />}
          {page === 'hierarchy' && <HierarchyDemo />}
          {page === 'frozen-pinned' && <FrozenPinned />}
          {page === 'multi-header' && <MultiHeaderDemo />}
          {page === 'core-only' && <CoreOnly />}
          {page === 'plugin-toggle' && <PluginToggle />}
          {page === 'performance' && <PerformanceDemo />}
          {page === 'merge-cells' && <MergeCellsDemo />}
          {page === 'selection-modes' && <SelectionModes />}
          {page === 'table-styles' && <TableStyles />}
          {page === 'always-input' && <AlwaysInputDemo />}
          {page === 'rhf-bridge' && <RhfBridgeDemo />}
          {page === 'column-features' && <ColumnFeaturesDemo />}
          {page === 'fsbt-program' && <div className="realworld-theme"><FsbtProgram /></div>}
          {page === 'fsbt-cost' && <div className="realworld-theme"><FsbtCost /></div>}
          {page === 'fsbt-revenue' && <div className="realworld-theme"><FsbtRevenue /></div>}
          {page === 'dm-timeline' && <div className="realworld-theme"><DmTimeline /></div>}
          {page === 'dm-forecast' && <div className="realworld-theme"><DmForecast /></div>}
          {page === 'dm-actuals' && <div className="realworld-theme"><DmActuals /></div>}
          {page === 'dm-summary' && <div className="realworld-theme"><DmSummary /></div>}
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

function WwSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#667085',
      marginTop: 20, marginBottom: 6, paddingLeft: 8, letterSpacing: '0.5px',
    }}>
      {children}
    </div>
  );
}

function WwNavButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        borderRadius: 8,
        background: active ? '#F2F4F7' : 'transparent',
        borderLeft: active ? '3px solid #065986' : '3px solid transparent',
        color: active ? '#101828' : '#475467',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 14,
        fontFamily: "'Inter', sans-serif",
        fontWeight: active ? 600 : 400,
        display: 'block',
        marginBottom: 2,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F9FAFB'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
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
