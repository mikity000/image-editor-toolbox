import React from 'react';
import { Size, Point } from './common';

export type PaintMediaType = 'image' | 'pdf' | null;

export type PaintToolType = 'pen' | 'highlighter' | 'eraser' | 'bucket' | 'smart_fill';

export type EraserMode = 'pixel' | 'stroke';

export type StrokePoint = Point;

export interface StrokeItem {
  id: string;
  tool: string;
  color: string;
  brushSize: number;
  points: StrokePoint[];
  isStraight?: boolean;
  imageObj?: HTMLImageElement | null;
  dataUrl?: string;
}

export interface PageHistoryEntry {
  dataUrl: string;
  strokes: StrokeItem[];
}

export interface PageHistory {
  undoStack: PageHistoryEntry[];
  redoStack: PageHistoryEntry[];
}

export interface UsePaintCanvasReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  bgCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  paintCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  mediaType: PaintMediaType;
  fileName: string;
  totalPages: number;
  currentPage: number;
  isLoading: boolean;
  loadingText: string;
  canvasDimensions: Size;
  activeTool: PaintToolType;
  setActiveTool: React.Dispatch<React.SetStateAction<PaintToolType>>;
  eraserMode: EraserMode;
  setEraserMode: React.Dispatch<React.SetStateAction<EraserMode>>;
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  tolerance: number;
  setTolerance: React.Dispatch<React.SetStateAction<number>>;
  fillOpacity: number;
  setFillOpacity: React.Dispatch<React.SetStateAction<number>>;
  gapClosing: number;
  setGapClosing: React.Dispatch<React.SetStateAction<number>>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: Point;
  setPan: React.Dispatch<React.SetStateAction<Point>>;
  isAltPressed: boolean;
  handleWheel: (e: React.WheelEvent<HTMLDivElement> | WheelEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoomPan: () => void;
  loadFile: (file: File) => Promise<void>;
  loadImageFromDataUrl: (dataUrl: string, name?: string) => void;
  changePage: (newPage: number) => Promise<void>;
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  undo: () => void;
  redo: () => void;
  clearCurrentCanvas: () => void;
  getCurrentMergedDataUrl: () => Promise<string | null>;
  exportAsImage: () => Promise<void>;
  exportAsPdf: () => Promise<void>;
}
