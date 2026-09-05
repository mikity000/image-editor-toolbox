import 'fabric';

declare module 'fabric' {
  interface FabricObject {
    id?: string;
    origSrc?: string;
    fileName?: string;
    isGuide?: boolean;
    isCroppingShape?: boolean;
    pointIndex?: number;
    pathOffset?: { x: number; y: number } | null;
    radius?: number;
    startLeft?: number;
    startTop?: number;
    isSelected?: boolean;
    isDrawingTemp?: boolean;
    isDrawingTempCircle?: boolean;
    _orig?: {
      left?: number;
      top?: number;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      width?: number;
      height?: number;
      originX?: string | number;
      originY?: string | number;
      corner?: string;
    };
    points?: Array<{ x: number; y: number }>;
    path?: Array<any>;
  }

  interface FabricImage {
    id?: string;
    origSrc?: string;
    fileName?: string;
  }

  interface Canvas {
    isExporting?: boolean;
    activeCropShape?: FabricObject | null;
    _isCropping?: boolean;
    isDrawingMode?: boolean;
    freeDrawingBrush?: any;
  }
}
