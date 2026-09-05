/**
 * クロップ機能関連の型定義
 */

export type CroppingMode = 'rect' | 'circle' | 'polygon' | 'path' | 'freehand' | null;

export interface CropPoint {
  x: number;
  y: number;
  isSelected?: boolean;
}

export interface CropShapeData {
  type?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  skewX?: number;
  skewY?: number;
  fill?: any;
  stroke?: any;
  strokeWidth?: number;
  strokeUniform?: boolean;
  borderColor?: string;
  cornerColor?: string;
  cornerSize?: number;
  transparentCorners?: boolean;
  objectCaching?: boolean;
  isCroppingShape?: boolean;
  isSelected?: boolean;
  points?: Array<{ x: number; y: number }>;
  pathOffset?: { x: number; y: number } | null;
  path?: any[];
  radius?: number;
}

export interface SerializedCropperState {
  croppingMode: CroppingMode;
  isDrawingPolygon: boolean;
  tempPoints: CropPoint[];
  shapesData: CropShapeData[];
}
