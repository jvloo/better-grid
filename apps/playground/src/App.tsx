import { useState } from 'react';
import { BasicGrid } from './pages/BasicGrid';
import { LargeDataset } from './pages/LargeDataset';

type Page = 'basic' | 'large';

export function App() {
  const [page, setPage] = useState<Page>('basic');

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
          gap: 4,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Better Grid</h2>
        <NavButton active={page === 'basic'} onClick={() => setPage('basic')}>
          Basic Grid
        </NavButton>
        <NavButton active={page === 'large'} onClick={() => setPage('large')}>
          Large Dataset
        </NavButton>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {page === 'basic' && <BasicGrid />}
        {page === 'large' && <LargeDataset />}
      </main>
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
