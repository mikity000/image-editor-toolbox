import { useRef, useCallback, useState, useEffect } from 'react';
import { Canvas, Polygon, Line, Circle, Point, FabricObject } from 'fabric';
import { clampPointToImageBounds } from '../utils/fabricBounds';
import { initEdgeDetectionCanvas, clearEdgeDetectionCanvas, findClosestEdge } from '../utils/edgeDetection';
import { CROP_CONFIG } from '../constants/Constants';
import { CropPoint, CroppingMode } from '../types/crop';

const getDistanceToSegment = (
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number => {
  const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projX, p.y - projY);
};

export interface InternalTempPoint {
  x: number;
  y: number;
  isSelected?: boolean;
  lineIn?: Line | null;
  lineOut?: Line | null;
  circle?: Circle | null;
  closingLine?: Line | null;
  closingLineIn?: Line | null;
}

export interface UsePolygonCropperReturn {
  polygonPointsRef: React.MutableRefObject<Array<{ x: number; y: number }>>;
  tempPointsRef: React.MutableRefObject<InternalTempPoint[]>;
  isMagneticMode: boolean;
  setIsMagneticMode: React.Dispatch<React.SetStateAction<boolean>>;
  magneticThreshold: number;
  setMagneticThreshold: React.Dispatch<React.SetStateAction<number>>;
  startPolygonDrawing: (initialPoints?: CropPoint[]) => void;
  handlePolygonMouseDown: (pointer: { x: number; y: number }, target?: any) => void;
  handlePolygonMouseMove: (pointer: { x: number; y: number }) => void;
  handlePolygonMouseUp: () => void;
  handlePolygonVertexMoving: (target: any) => void;
  finishPolygonDrawing: () => void;
  editPolygonVertices: (
    drawingObject: FabricObject | null,
    startCropping?: (mode: CroppingMode, points?: CropPoint[]) => void
  ) => void;
  adjustActiveVertex: (dx: number, dy: number) => void;
  deleteActiveVertex: (
    startCropping?: (mode: CroppingMode, points?: CropPoint[]) => void
  ) => void;
  selectVertexAtPosition: (x: number, y: number) => void;
  getTempPolygon: () => Polygon | null;
  getTempPoints: () => CropPoint[];
  handlePolygonVertexMouseDown: (target: any, e: any) => void;
  clearVertexSelection: (e?: any) => void;
}

export function usePolygonCropper(
  fabricCanvasRef: React.RefObject<Canvas | null> | { current: Canvas | null },
  setDrawingObject?: ((obj: FabricObject | null) => void) | null,
  triggerAutoCrop?: (() => void) | null,
  setActiveVertices?: ((vertices: Array<{ x: number; y: number }>) => void) | null,
  isDrawingPolygon: boolean = false,
  setIsDrawingPolygon?: ((isDrawing: boolean) => void) | null,
  setCroppingMode?: ((mode: CroppingMode) => void) | null
): UsePolygonCropperReturn {
  const polygonPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const tempPointsRef = useRef<InternalTempPoint[]>([]);
  const draggingPointIndexRef = useRef<number | null>(null);

  const updateActiveVertices = useCallback(() => {
    const selectedPoints = tempPointsRef.current.filter((p) => p.isSelected);
    setActiveVertices?.(selectedPoints.map((p) => ({ x: p.x, y: p.y })));
  }, [setActiveVertices]);

  const [isMagneticMode, setIsMagneticMode] = useState<boolean>(false);
  const [magneticThreshold, setMagneticThreshold] = useState<number>(
    CROP_CONFIG.MAGNETIC_THRESHOLD_DEFAULT
  );

  const isMagneticModeRef = useRef<boolean>(isMagneticMode);
  const magneticThresholdRef = useRef<number>(magneticThreshold);
  const magneticPreviewLineRef = useRef<Line | null>(null);
  const magneticPreviewCircleRef = useRef<Circle | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    isMagneticModeRef.current = isMagneticMode;
  }, [isMagneticMode]);
  useEffect(() => {
    magneticThresholdRef.current = magneticThreshold;
  }, [magneticThreshold]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (isMagneticMode && canvas && isDrawingPolygon) {
      initEdgeDetectionCanvas(canvas);
    } else {
      clearEdgeDetectionCanvas();
      if (canvas) {
        if (magneticPreviewLineRef.current) {
          canvas.remove(magneticPreviewLineRef.current);
          magneticPreviewLineRef.current = null;
        }
        if (magneticPreviewCircleRef.current) {
          canvas.remove(magneticPreviewCircleRef.current);
          magneticPreviewCircleRef.current = null;
        }
        canvas.renderAll();
      }
    }
  }, [isMagneticMode, fabricCanvasRef, isDrawingPolygon]);

  const rebuildTempShapes = useCallback((canvas: Canvas | null) => {
    if (!canvas) return;
    canvas.getObjects().forEach((obj) => {
      if (obj.isDrawingTemp) canvas.remove(obj);
    });

    tempPointsRef.current.forEach((p) => {
      p.lineIn = null;
      p.lineOut = null;
      p.circle = null;
      p.closingLine = null;
      p.closingLineIn = null;
    });

    tempPointsRef.current.forEach((p, index) => {
      if (index > 0) {
        const prev = tempPointsRef.current[index - 1];
        const line = new Line([prev.x, prev.y, p.x, p.y], {
          stroke: 'red',
          strokeWidth: 2,
          selectable: false,
          evented: false,
          isDrawingTemp: true,
        });
        prev.lineOut = line;
        p.lineIn = line;
        canvas.add(line);
      }
      const circle = new Circle({
        radius: 5,
        fill: p.isSelected ? '#32cd32' : 'red',
        left: p.x - 5,
        top: p.y - 5,
        strokeWidth: p.isSelected ? 1 : 0,
        stroke: p.isSelected ? '#000' : null,
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'pointer',
        isDrawingTemp: true,
        isDrawingTempCircle: true,
        pointIndex: index,
        padding: CROP_CONFIG.VERTEX_HIT_PADDING,
      });

      circle.isSelected = p.isSelected;
      p.circle = circle;
      canvas.add(circle);
    });

    if (tempPointsRef.current.length >= 3) {
      const first = tempPointsRef.current[0];
      const last = tempPointsRef.current[tempPointsRef.current.length - 1];
      const line = new Line([last.x, last.y, first.x, first.y], {
        stroke: 'red',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        isDrawingTemp: true,
      });
      last.closingLine = line;
      first.closingLineIn = line;
      canvas.add(line);
    }

    polygonPointsRef.current = tempPointsRef.current.map((p) => ({ x: p.x, y: p.y }));
  }, []);

  const updateVertexPosition = useCallback((idx: number, clampedX: number, clampedY: number) => {
    const pt = tempPointsRef.current[idx];
    if (!pt) return;
    pt.x = clampedX;
    pt.y = clampedY;
    if (pt.lineIn) pt.lineIn.set({ x2: pt.x, y2: pt.y });
    if (pt.lineOut) pt.lineOut.set({ x1: pt.x, y1: pt.y });
    if (pt.closingLine) pt.closingLine.set({ x1: pt.x, y1: pt.y });
    if (pt.closingLineIn) pt.closingLineIn.set({ x2: pt.x, y2: pt.y });
    polygonPointsRef.current = tempPointsRef.current.map((p) => ({ x: p.x, y: p.y }));
  }, []);

  const updateMagneticPreview = useCallback(
    (pointer: { x: number; y: number } | null) => {
      const canvas = fabricCanvasRef.current;
      if (
        !canvas ||
        !isMagneticModeRef.current ||
        tempPointsRef.current.length === 0 ||
        !pointer
      )
        return;

      const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
      const snapResult = findClosestEdge(
        clampedPointer.x,
        clampedPointer.y,
        CROP_CONFIG.SNAP_RADIUS,
        magneticThresholdRef.current
      );
      const targetPoint = snapResult;

      const lastPoint = tempPointsRef.current[tempPointsRef.current.length - 1];

      if (!magneticPreviewLineRef.current) {
        magneticPreviewLineRef.current = new Line(
          [lastPoint.x, lastPoint.y, targetPoint.x, targetPoint.y],
          {
            stroke: 'cyan',
            strokeWidth: 2,
            strokeDashArray: [3, 3],
            selectable: false,
            evented: false,
            isDrawingTemp: true,
          }
        );
        canvas.add(magneticPreviewLineRef.current);
      } else {
        magneticPreviewLineRef.current.set({
          x1: lastPoint.x,
          y1: lastPoint.y,
          x2: targetPoint.x,
          y2: targetPoint.y,
        });
      }

      if (!magneticPreviewCircleRef.current) {
        magneticPreviewCircleRef.current = new Circle({
          radius: 4,
          fill: snapResult.snapped ? 'cyan' : 'gray',
          left: targetPoint.x - 4,
          top: targetPoint.y - 4,
          selectable: false,
          evented: false,
          isDrawingTemp: true,
        });
        canvas.add(magneticPreviewCircleRef.current);
      } else {
        magneticPreviewCircleRef.current.set({
          left: targetPoint.x - 4,
          top: targetPoint.y - 4,
          fill: snapResult.snapped ? 'cyan' : 'gray',
        });
      }

      canvas.renderAll();
    },
    [fabricCanvasRef]
  );

  const startPolygonDrawing = useCallback(
    (initialPoints: CropPoint[] = []) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      draggingPointIndexRef.current = null;

      if (isMagneticModeRef.current) {
        initEdgeDetectionCanvas(canvas);
      }

      if (initialPoints.length > 0) {
        tempPointsRef.current = initialPoints.map((p) => ({
          x: p.x,
          y: p.y,
          isSelected: false,
        }));
        rebuildTempShapes(canvas);

        magneticPreviewLineRef.current = null;
        magneticPreviewCircleRef.current = null;

        if (isMagneticModeRef.current && lastPointerRef.current) {
          updateMagneticPreview(lastPointerRef.current);
        }
      } else {
        tempPointsRef.current = [];
        polygonPointsRef.current = [];
        magneticPreviewLineRef.current = null;
        magneticPreviewCircleRef.current = null;
      }
    },
    [fabricCanvasRef, rebuildTempShapes, updateMagneticPreview]
  );

  const handlePolygonMouseDown = useCallback(
    (pointer: { x: number; y: number }, target?: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      if (target && target.isDrawingTempCircle) return;

      const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
      let ptObj = { x: clampedPointer.x, y: clampedPointer.y };

      if (isMagneticModeRef.current) {
        const snapResult = findClosestEdge(
          clampedPointer.x,
          clampedPointer.y,
          CROP_CONFIG.SNAP_RADIUS,
          magneticThresholdRef.current
        );
        ptObj = { x: snapResult.x, y: snapResult.y };
      }

      let insertIndex = tempPointsRef.current.length;

      if (tempPointsRef.current.length >= 2) {
        let minDist: number = CROP_CONFIG.VERTEX_INSERT_DISTANCE;

        for (let i = 0; i < tempPointsRef.current.length; i++) {
          if (i === tempPointsRef.current.length - 1 && tempPointsRef.current.length < 3) continue;

          const p1 = tempPointsRef.current[i];
          const p2 = tempPointsRef.current[(i + 1) % tempPointsRef.current.length];
          const d = getDistanceToSegment(clampedPointer, p1, p2);
          if (d < minDist) {
            minDist = d;
            insertIndex = i + 1;
          }
        }
      }

      tempPointsRef.current.splice(insertIndex, 0, { ...ptObj, isSelected: true });
      rebuildTempShapes(canvas);

      const newPt = tempPointsRef.current[insertIndex];
      if (newPt && newPt.circle) {
        newPt.circle.startLeft = newPt.circle.left;
        newPt.circle.startTop = newPt.circle.top;
        canvas.setActiveObject(newPt.circle);
      }
      draggingPointIndexRef.current = insertIndex;
      updateActiveVertices();

      if (magneticPreviewLineRef.current) {
        canvas.remove(magneticPreviewLineRef.current);
        magneticPreviewLineRef.current = null;
      }
      if (magneticPreviewCircleRef.current) {
        canvas.remove(magneticPreviewCircleRef.current);
        magneticPreviewCircleRef.current = null;
      }

      if (tempPointsRef.current.length >= 3) {
        triggerAutoCrop?.();
      }
    },
    [fabricCanvasRef, rebuildTempShapes, triggerAutoCrop, updateActiveVertices]
  );

  const handlePolygonMouseMove = useCallback(
    (pointer: { x: number; y: number }) => {
      lastPointerRef.current = pointer;
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      if (draggingPointIndexRef.current !== null) {
        const idx = draggingPointIndexRef.current;
        const pt = tempPointsRef.current[idx];
        if (pt && pt.circle) {
          const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
          const radius = pt.circle.radius || 0;
          pt.circle.set({
            left: clampedPointer.x - radius,
            top: clampedPointer.y - radius,
          });
          pt.circle.setCoords();
          updateVertexPosition(idx, clampedPointer.x, clampedPointer.y);
          if (tempPointsRef.current.length >= 3) {
            updateActiveVertices();
          }
          canvas.renderAll();
          return;
        }
      }

      updateMagneticPreview(pointer);
    },
    [fabricCanvasRef, updateMagneticPreview, updateVertexPosition, updateActiveVertices]
  );

  const handlePolygonMouseUp = useCallback(() => {
    if (draggingPointIndexRef.current !== null) {
      draggingPointIndexRef.current = null;
      if (tempPointsRef.current.length >= 3) {
        triggerAutoCrop?.();
      }
    }
  }, [triggerAutoCrop]);

  const handlePolygonVertexMoving = useCallback(
    (target: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !target.isDrawingTempCircle) return;

      const radius = target.radius || 0;
      const cx = target.left + radius;
      const cy = target.top + radius;
      const clamped = clampPointToImageBounds({ x: cx, y: cy }, canvas);

      target.set({ left: clamped.x - radius, top: clamped.y - radius });
      target.setCoords();

      const dx = target.left - (target.startLeft !== undefined ? target.startLeft : target.left);
      const dy = target.top - (target.startTop !== undefined ? target.startTop : target.top);

      tempPointsRef.current.forEach((pt, idx) => {
        if (pt.isSelected && idx !== target.pointIndex && pt.circle) {
          const circle = pt.circle;
          const startLeft = circle.startLeft !== undefined ? circle.startLeft : circle.left;
          const startTop = circle.startTop !== undefined ? circle.startTop : circle.top;
          const newLeft = startLeft + dx;
          const newTop = startTop + dy;

          const cRadius = circle.radius || 0;
          const ncx = newLeft + cRadius;
          const ncy = newTop + cRadius;
          const clampedOther = clampPointToImageBounds({ x: ncx, y: ncy }, canvas);

          circle.set({ left: clampedOther.x - cRadius, top: clampedOther.y - cRadius });
          circle.setCoords();

          updateVertexPosition(idx, clampedOther.x, clampedOther.y);
        }
      });

      const idx = target.pointIndex;
      updateVertexPosition(idx, clamped.x, clamped.y);

      if (tempPointsRef.current.length >= 3) {
        updateActiveVertices();
      }

      canvas.renderAll();
    },
    [fabricCanvasRef, updateActiveVertices, updateVertexPosition]
  );

  const finishPolygonDrawing = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || polygonPointsRef.current.length < 3) {
      alert('多角形を描くには最低3つの頂点が必要です。');
      return;
    }

    draggingPointIndexRef.current = null;

    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (obj.isDrawingTemp || obj.isDrawingTempCircle) canvas.remove(obj);
    });

    if (magneticPreviewLineRef.current) magneticPreviewLineRef.current = null;
    if (magneticPreviewCircleRef.current) magneticPreviewCircleRef.current = null;

    const polygon = new Polygon(polygonPointsRef.current, {
      fill: 'transparent',
      stroke: 'red',
      strokeWidth: 1,
      strokeUniform: true,
      borderColor: 'red',
      cornerColor: 'green',
      cornerSize: 10,
      transparentCorners: false,
      hasControls: true,
      hasBorders: true,
      isCroppingShape: true,
      objectCaching: false,
    } as any);

    polygon.setControlsVisibility({ mtr: false });
    canvas.add(polygon);
    canvas.setActiveObject(polygon);
    setDrawingObject?.(polygon);
    setIsDrawingPolygon?.(false);
    setCroppingMode?.(null);

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    triggerAutoCrop?.();
  }, [fabricCanvasRef, setDrawingObject, setIsDrawingPolygon, setCroppingMode, triggerAutoCrop]);

  const editPolygonVertices = useCallback(
    (
      drawingObject: FabricObject | null,
      startCropping?: (mode: CroppingMode, points?: CropPoint[]) => void
    ) => {
      if (!drawingObject || drawingObject.type !== 'polygon') return;
      const matrix = drawingObject.calcTransformMatrix ? drawingObject.calcTransformMatrix() : [1, 0, 0, 1, 0, 0];
      const points = drawingObject.points || [];
      const absolutePoints = points.map((p) => {
        const pathOffsetX = drawingObject.pathOffset ? drawingObject.pathOffset.x : 0;
        const pathOffsetY = drawingObject.pathOffset ? drawingObject.pathOffset.y : 0;
        const localPoint = new Point(p.x - pathOffsetX, p.y - pathOffsetY);
        const absPoint = localPoint.transform(matrix as any);
        return { x: absPoint.x, y: absPoint.y };
      });

      const canvas = fabricCanvasRef.current;
      if (canvas) {
        canvas.remove(drawingObject);
      }

      startCropping?.('polygon', absolutePoints);
    },
    [fabricCanvasRef]
  );

  const getTempPolygon = useCallback((): Polygon | null => {
    if (tempPointsRef.current && tempPointsRef.current.length >= 3) {
      return new Polygon(
        tempPointsRef.current.map((p) => ({ x: p.x, y: p.y })),
        {
          absolutePositioned: true,
        }
      );
    }
    return null;
  }, []);

  const adjustActiveVertex = useCallback(
    (dx: number, dy: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      let representativeCircle: Circle | null = null;
      tempPointsRef.current.forEach((pt, idx) => {
        if (pt.isSelected && pt.circle) {
          const circle = pt.circle;
          const radius = circle.radius || 0;
          const cx = circle.left + radius + dx;
          const cy = circle.top + radius + dy;
          const clamped = clampPointToImageBounds({ x: cx, y: cy }, canvas);

          circle.set({ left: clamped.x - radius, top: clamped.y - radius });
          circle.setCoords();

          updateVertexPosition(idx, clamped.x, clamped.y);
          representativeCircle = circle;
        }
      });

      if (representativeCircle && tempPointsRef.current.length >= 3) {
        updateActiveVertices();
      }

      canvas.renderAll();
      triggerAutoCrop?.();
    },
    [fabricCanvasRef, triggerAutoCrop, updateActiveVertices, updateVertexPosition]
  );

  const deleteActiveVertex = useCallback(
    (startCropping?: (mode: CroppingMode, points?: CropPoint[]) => void) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const selectedIndices = tempPointsRef.current
        .map((p, i) => (p.isSelected ? i : -1))
        .filter((idx) => idx !== -1);

      if (selectedIndices.length === 0) {
        const activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.isDrawingTempCircle && activeObj.pointIndex !== undefined) {
          selectedIndices.push(activeObj.pointIndex);
        }
      }

      if (selectedIndices.length > 0) {
        const updatedPoints = tempPointsRef.current
          .filter((_, i) => !selectedIndices.includes(i))
          .map((p) => ({ x: p.x, y: p.y }));

        startCropping?.('polygon', updatedPoints);
        triggerAutoCrop?.();
      }
    },
    [fabricCanvasRef, triggerAutoCrop]
  );

  const selectVertexAtPosition = useCallback(
    (x: number, y: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const circles = canvas.getObjects().filter((obj) => obj.isDrawingTempCircle);
      if (circles.length === 0) return;

      let closestCircle: FabricObject | null = null;
      let minDistance = Infinity;

      circles.forEach((circle) => {
        const radius = circle.radius || 0;
        const cx = circle.left + radius;
        const cy = circle.top + radius;
        const dist = Math.hypot(cx - x, cy - y);

        if (dist < minDistance) {
          minDistance = dist;
          closestCircle = circle;
        }
      });

      if (closestCircle && minDistance <= CROP_CONFIG.VERTEX_SELECT_RADIUS) {
        const idx = (closestCircle as FabricObject).pointIndex;

        tempPointsRef.current.forEach((pt, i) => {
          const isCurrent = i === idx;
          pt.isSelected = isCurrent;
          if (pt.circle) {
            pt.circle.isSelected = isCurrent;
            pt.circle.set({
              fill: isCurrent ? '#32cd32' : 'red',
              strokeWidth: isCurrent ? 1 : 0,
              stroke: isCurrent ? '#000' : null,
            });
          }
        });

        updateActiveVertices();

        canvas.setActiveObject(closestCircle);
        canvas.renderAll();
      }
    },
    [fabricCanvasRef, updateActiveVertices]
  );

  const handlePolygonVertexMouseDown = useCallback(
    (target: any, e: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !target || !target.isDrawingTempCircle) return;

      const idx = target.pointIndex;
      const isCtrl = e && (e.ctrlKey || e.metaKey);

      if (isCtrl) {
        const newValue = !tempPointsRef.current[idx].isSelected;
        tempPointsRef.current[idx].isSelected = newValue;
        target.isSelected = newValue;
        target.set({
          fill: newValue ? '#32cd32' : 'red',
          strokeWidth: newValue ? 1 : 0,
          stroke: newValue ? '#000' : null,
        });
      } else {
        tempPointsRef.current.forEach((pt, i) => {
          const isCurrent = i === idx;
          pt.isSelected = isCurrent;
          if (pt.circle) {
            pt.circle.isSelected = isCurrent;
            pt.circle.set({
              fill: isCurrent ? '#32cd32' : 'red',
              strokeWidth: isCurrent ? 1 : 0,
              stroke: isCurrent ? '#000' : null,
            });
          }
        });
      }

      tempPointsRef.current.forEach((pt) => {
        if (pt.circle && pt.isSelected) {
          pt.circle.startLeft = pt.circle.left;
          pt.circle.startTop = pt.circle.top;
        }
      });

      updateActiveVertices();

      canvas.renderAll();
    },
    [fabricCanvasRef, updateActiveVertices]
  );

  const clearVertexSelection = useCallback(
    (e?: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const isCtrl = e && (e.ctrlKey || e.metaKey);
      if (!isCtrl) {
        let changed = false;
        tempPointsRef.current.forEach((pt) => {
          if (pt.isSelected) {
            pt.isSelected = false;
            changed = true;
            if (pt.circle) {
              pt.circle.isSelected = false;
              pt.circle.set({
                fill: 'red',
                strokeWidth: 0,
                stroke: null,
              });
            }
          }
        });
        if (changed) {
          updateActiveVertices();
          canvas.renderAll();
        }
      }
    },
    [fabricCanvasRef, updateActiveVertices]
  );

  const getTempPoints = useCallback((): CropPoint[] => {
    return tempPointsRef.current.map((p) => ({ x: p.x, y: p.y, isSelected: !!p.isSelected }));
  }, []);

  return {
    polygonPointsRef,
    tempPointsRef,
    isMagneticMode,
    setIsMagneticMode,
    magneticThreshold,
    setMagneticThreshold,
    startPolygonDrawing,
    handlePolygonMouseDown,
    handlePolygonMouseMove,
    handlePolygonMouseUp,
    handlePolygonVertexMoving,
    finishPolygonDrawing,
    editPolygonVertices,
    adjustActiveVertex,
    deleteActiveVertex,
    selectVertexAtPosition,
    getTempPolygon,
    getTempPoints,
    handlePolygonVertexMouseDown,
    clearVertexSelection,
  };
}
