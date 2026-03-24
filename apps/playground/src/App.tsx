import { useState } from 'react';
import { CoreOnly } from './pages/CoreOnly';
import { BasicGrid } from './pages/BasicGrid';
import { EditableGrid } from './pages/EditableGrid';
import { ComplexGrid } from './pages/ComplexGrid';
import { LargeDataset } from './pages/LargeDataset';
import { ProPreview } from './pages/ProPreview';

type Page = 'core' | 'free' | 'editable' | 'complex' | 'large' | 'pro';

export function App() {
  const [page, setPage] = useState<Page>('core');

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          background: '#f8f9fa',
          borderRight: '1px solid #e0e0e0',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Better Grid</h2>

        <SectionLabel>Core</SectionLabel>
        <NavButton active={page === 'core'} onClick={() => setPage('core')}>
          Core Only
        </NavButton>
        <NavButton active={page === 'large'} onClick={() => setPage('large')}>
          Large Dataset
        </NavButton>

        <SectionLabel>Free Plugins</SectionLabel>
        <NavButton active={page === 'free'} onClick={() => setPage('free')}>
          All 5 Plugins
        </NavButton>
        <NavButton active={page === 'editable'} onClick={() => setPage('editable')}>
          Editor Types
        </NavButton>

        <SectionLabel>Showcase</SectionLabel>
        <NavButton active={page === 'complex'} onClick={() => setPage('complex')}>
          Financial Grid
        </NavButton>

        <SectionLabel>Pro Plugins</SectionLabel>
        <NavButton active={page === 'pro'} onClick={() => setPage('pro')}>
          Coming Soon
        </NavButton>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {page === 'core' && <CoreOnly />}
        {page === 'large' && <LargeDataset />}
        {page === 'free' && <BasicGrid />}
        {page === 'editable' && <EditableGrid />}
        {page === 'complex' && <ComplexGrid />}
        {page === 'pro' && <ProPreview />}
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: '#999',
        marginTop: 12,
        marginBottom: 4,
        paddingLeft: 12,
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        border: 'none',
        borderRadius: 6,
        background: active ? '#1a73e8' : 'transparent',
        color: active ? '#fff' : '#333',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 14,
      }}
    >
      {children}
    </button>
  );
}
