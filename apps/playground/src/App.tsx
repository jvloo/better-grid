import { useState } from 'react';
import { CoreOnly } from './pages/CoreOnly';
import { LargeDataset } from './pages/LargeDataset';
import { MultiHeader } from './pages/MultiHeader';
import { FormatEdit } from './pages/FormatEdit';
import { SortFilter } from './pages/SortFilter';
import { ValidationDemo } from './pages/ValidationDemo';
import { EditableGrid } from './pages/EditableGrid';
import { ProPreview } from './pages/ProPreview';
import { ComplexGrid } from './pages/ComplexGrid';
import { TaskTracker } from './pages/TaskTracker';

type Page = 'core' | 'large' | 'multi-header' | 'format-edit' | 'sort-filter' | 'validation' | 'editor-ref' | 'pro' | 'financial' | 'task-tracker';

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
          Core Basics
        </NavButton>
        <NavButton active={page === 'large'} onClick={() => setPage('large')}>
          Virtual Scrolling
        </NavButton>
        <NavButton active={page === 'multi-header'} onClick={() => setPage('multi-header')}>
          Multi-Header
        </NavButton>

        <SectionLabel>Free Plugins</SectionLabel>
        <NavButton active={page === 'format-edit'} onClick={() => setPage('format-edit')}>
          Format & Edit
        </NavButton>
        <NavButton active={page === 'sort-filter'} onClick={() => setPage('sort-filter')}>
          Sort & Filter
        </NavButton>
        <NavButton active={page === 'validation'} onClick={() => setPage('validation')}>
          Validation
        </NavButton>
        <NavButton active={page === 'editor-ref'} onClick={() => setPage('editor-ref')}>
          Editor Reference
        </NavButton>

        <SectionLabel>Pro Plugins</SectionLabel>
        <NavButton active={page === 'pro'} onClick={() => setPage('pro')}>
          Coming Soon
        </NavButton>

        <SectionLabel>Showcase</SectionLabel>
        <NavButton active={page === 'financial'} onClick={() => setPage('financial')}>
          Financial Grid
        </NavButton>
        <NavButton active={page === 'task-tracker'} onClick={() => setPage('task-tracker')}>
          Task Tracker
        </NavButton>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {page === 'core' && <CoreOnly />}
        {page === 'large' && <LargeDataset />}
        {page === 'multi-header' && <MultiHeader />}
        {page === 'format-edit' && <FormatEdit />}
        {page === 'sort-filter' && <SortFilter />}
        {page === 'validation' && <ValidationDemo />}
        {page === 'editor-ref' && <EditableGrid />}
        {page === 'pro' && <ProPreview />}
        {page === 'financial' && <ComplexGrid />}
        {page === 'task-tracker' && <TaskTracker />}
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
