// ============================================================================
// BetterGrid — React component wrapper
// ============================================================================

import { memo } from 'react';
import type { GridOptions, GridPlugin } from '@better-grid/core';
import { useGrid } from './hooks/useGrid';

export interface BetterGridProps<
  TData = unknown,
  TPlugins extends GridPlugin[] = GridPlugin[],
> extends GridOptions<TData, TPlugins> {
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
}

function BetterGridInner<
  TData = unknown,
  TPlugins extends GridPlugin[] = GridPlugin[],
>(props: BetterGridProps<TData, TPlugins>) {
  const { className, style, width, height, ...gridOptions } = props;
  const { containerRef } = useGrid(gridOptions as GridOptions<TData, TPlugins>);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: width ?? '100%',
        height: height ?? '100%',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    />
  );
}

export const BetterGrid = memo(BetterGridInner) as typeof BetterGridInner;
