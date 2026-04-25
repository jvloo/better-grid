// ============================================================================
// BetterGrid — React component wrapper
// ============================================================================

import { memo } from 'react';
import { useGrid } from './useGrid';
import type { GridHandle, ReactGridOptions } from './types';

interface CommonProps {
  className?: string;
  style?: React.CSSProperties;
  height?: number | string;
  width?: number | string;
}

export type BetterGridProps<TData = unknown, TContext = unknown> =
  | ({ grid: GridHandle<TData, TContext> } & CommonProps)
  | (ReactGridOptions<TData, TContext> & { grid?: undefined } & CommonProps);

function BetterGridView<TData, TContext>(props: { handle: GridHandle<TData, TContext> } & CommonProps) {
  const width = props.width ?? '100%';
  const height = props.height ?? '100%';
  return (
    <div
      ref={props.handle.containerRef}
      className={props.className}
      style={{ width, height, position: 'relative', overflow: 'hidden', ...props.style }}
    />
  );
}

function BetterGridSelfManaging<TData, TContext>(props: ReactGridOptions<TData, TContext> & CommonProps) {
  const handle = useGrid<TData, TContext>(props);
  const width = props.width ?? props.size?.width ?? '100%';
  const height = props.height ?? props.size?.height ?? '100%';
  return (
    <BetterGridView
      handle={handle}
      className={props.className}
      style={props.style}
      width={width}
      height={height}
    />
  );
}

function BetterGridInner<TData = unknown, TContext = unknown>(props: BetterGridProps<TData, TContext>) {
  // Dispatch into the appropriate variant. This avoids conditional `useGrid`
  // calls (rules-of-hooks) by ensuring each branch has a stable hook count.
  if ('grid' in props && props.grid) {
    return (
      <BetterGridView
        handle={props.grid}
        className={props.className}
        style={props.style}
        width={props.width}
        height={props.height}
      />
    );
  }
  return <BetterGridSelfManaging {...(props as ReactGridOptions<TData, TContext> & CommonProps)} />;
}

export const BetterGrid = memo(BetterGridInner) as typeof BetterGridInner;
