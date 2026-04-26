/**
 * Integration test: 'link' cellType renderer registered by the cellRenderers plugin.
 *
 * Verifies that:
 * - A column with cellType: 'link' renders an <a> element with the correct href,
 *   target, and rel attributes.
 * - Text content defaults to the href value, or uses valueFormatter when provided.
 * - meta.link options (target, rel, label) override the defaults.
 * - Empty/null/undefined values render nothing (no broken <a href="">).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { cellRenderers } from '../../plugins/src/free/cell-renderers';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  url: string | null | undefined;
  label: string;
}

const data: Row[] = [
  { id: 1, url: 'https://example.com', label: 'Example' },
  { id: 2, url: null, label: 'Null URL' },
  { id: 3, url: undefined, label: 'Undefined URL' },
  { id: 4, url: '', label: 'Empty URL' },
];

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('link cellType renderer', () => {
  it('renders an <a> with href=value, target="_blank", rel="noopener noreferrer"', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'url', field: 'url', headerName: 'URL', cellType: 'link' },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [{ id: 1, url: 'https://example.com', label: 'Example' }],
      plugins: [cellRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const anchor = host.querySelector('a.bg-cell-link') as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toBe('https://example.com/');
    expect(anchor!.target).toBe('_blank');
    expect(anchor!.rel).toBe('noopener noreferrer');
    expect(anchor!.textContent).toBe('https://example.com');

    grid.unmount();
  });

  it('uses valueFormatter output as link text when provided', () => {
    const columns: ColumnDef<Row>[] = [
      {
        id: 'url',
        field: 'url',
        headerName: 'URL',
        cellType: 'link',
        valueFormatter: (_value, row) => (row as Row).label,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [{ id: 1, url: 'https://example.com', label: 'Example Site' }],
      plugins: [cellRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const anchor = host.querySelector('a.bg-cell-link') as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    expect(anchor!.href).toBe('https://example.com/');
    expect(anchor!.textContent).toBe('Example Site');

    grid.unmount();
  });

  it('respects meta.link options: target, rel, and label override', () => {
    const columns: ColumnDef<Row>[] = [
      {
        id: 'url',
        field: 'url',
        headerName: 'URL',
        cellType: 'link',
        meta: {
          link: { target: '_self', rel: 'noopener', label: 'Open page' },
        },
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [{ id: 1, url: 'https://example.com', label: 'Example' }],
      plugins: [cellRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const anchor = host.querySelector('a.bg-cell-link') as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    expect(anchor!.target).toBe('_self');
    expect(anchor!.rel).toBe('noopener');
    expect(anchor!.textContent).toBe('Open page');

    grid.unmount();
  });

  it('renders no anchor for null value', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'url', field: 'url', headerName: 'URL', cellType: 'link' },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [{ id: 2, url: null, label: 'Null URL' }],
      plugins: [cellRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const anchor = host.querySelector('a.bg-cell-link');
    expect(anchor).toBeNull();

    grid.unmount();
  });

  it('renders no anchor for empty string value', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'url', field: 'url', headerName: 'URL', cellType: 'link' },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [{ id: 4, url: '', label: 'Empty URL' }],
      plugins: [cellRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const anchor = host.querySelector('a.bg-cell-link');
    expect(anchor).toBeNull();

    grid.unmount();
  });
});
