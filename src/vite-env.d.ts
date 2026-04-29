/// <reference types="vite/client" />

declare module '*.wasm?url' {
  const src: string;
  export default src;
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const src: string;
  export default src;
}

declare module 'react-grid-layout' {
  import * as React from 'react';
  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
  }
  export interface ReactGridLayoutProps {
    className?: string;
    layout?: Layout[];
    cols?: number;
    rowHeight?: number;
    width?: number;
    margin?: [number, number];
    containerPadding?: [number, number];
    isDraggable?: boolean;
    isResizable?: boolean;
    onLayoutChange?: (layout: Layout[]) => void;
    draggableCancel?: string;
    draggableHandle?: string;
    children?: React.ReactNode;
    compactType?: 'vertical' | 'horizontal' | null;
    preventCollision?: boolean;
  }
  const GridLayout: React.ComponentType<ReactGridLayoutProps>;
  export default GridLayout;
  export function WidthProvider<P>(C: React.ComponentType<P>): React.ComponentType<P & { measureBeforeMount?: boolean }>;
  export const Responsive: React.ComponentType<any>;
}

declare module 'react-grid-layout/css/styles.css';
declare module 'react-resizable/css/styles.css';
