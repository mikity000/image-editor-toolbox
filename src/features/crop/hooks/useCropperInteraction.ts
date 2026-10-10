import { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas, FabricObject } from 'fabric';
import { clampMoveToImageBounds, clampScaleToImageBounds } from '../utils/fabricBounds';
import { usePolygonCropper } from './usePolygonCropper';
import { useFreehandCropper } from './useFreehandCropper';
import { useBasicShapeCropper } from './useBasicShapeCropper';
import { useCropperUndoRedo, serializeCropperState, restoreCropperState } from './useCropperUndoRedo';
import { CroppingMode, CropPoint, SerializedCropperState } from '../types/crop';

export interface UseCropperInteractionReturn {
  croppingMode: CroppingMode;
  drawingObject: FabricObject | null;
  isDrawingPolygon: boolean;
  autoCropCount: number;
  activeVertices: Array<{ x: number; y: number }>;
  isMagneticMode: boolean;
  setIsMagneticMode: React.Dispatch<React.SetStateAction<boolean>>;
  magneticThreshold: number;
  setMagneticThreshold: React.Dispatch<React.SetStateAction<number>>;
  startCropping: (mode: CroppingMode, initialPolygonPoints?: CropPoint[]) => void;
  finishPolygonDrawing: () => void;
  editPolygonVertices: () => void;
  adjustCroppingShape: (side: 'top' | 'bottom' | 'left' | 'right', direction: number) => void;
  adjustActiveVertex: (dx: number, dy: number) => void;
  deleteActiveVertex: () => void;
  deleteActiveShape: () => void;
  getTempPolygon: () => any;
  selectVertexAtPosition: (x: number, y: number) => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

export function useCropperInteraction(
  fabricCanvasRef: React.RefObject<Canvas | null> | { current: Canvas | null },
  imageLoaded: boolean,
  setCroppedImageUrl?: ((url: string | null) => void) | null,
  pathSmoothing: number = 8
): UseCropperInteractionReturn {
  const [croppingMode, setCroppingMode] = useState<CroppingMode>(null);
  const [drawingObject, setDrawingObject] = useState<FabricObject | null>(null);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState<boolean>(false);
  const [adjustmentAmount] = useState<number>(1);
  const [autoCropCount, setAutoCropCount] = useState<number>(0);
  const [activeVertices, setActiveVertices] = useState<Array<{ x: number; y: number }>>([]);

  const croppingModeRef = useRef<CroppingMode>(croppingMode);
  const isDrawingPolygonRef = useRef<boolean>(isDrawingPolygon);
  useEffect(() => {
    croppingModeRef.current = croppingMode;
  }, [croppingMode]);
  useEffect(() => {
    isDrawingPolygonRef.current = isDrawingPolygon;
  }, [isDrawingPolygon]);

  const triggerAutoCrop = useCallback(() => setAutoCropCount((c) => c + 1), []);

  const globalUnsubsRef = useRef<(() => void)[]>([]);
  const drawingUnsubsRef = useRef<(() => void)[]>([]);

  const clearDrawingListeners = useCallback(() => {
    drawingUnsubsRef.current.forEach((unsub) => unsub());
    drawingUnsubsRef.current = [];
  }, []);

  const clearAllListeners = useCallback(() => {
    drawingUnsubsRef.current.forEach((unsub) => unsub());
    drawingUnsubsRef.current = [];
    globalUnsubsRef.current.forEach((unsub) => unsub());
    globalUnsubsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllListeners();
    };
  }, [clearAllListeners]);

  const { saveState, undo, redo, clearHistory, canUndo, canRedo } = useCropperUndoRedo();

  const {
    startPolygonDrawing,
    handlePolygonMouseDown,
    handlePolygonMouseMove,
    handlePolygonMouseUp,
    handlePolygonVertexMoving,
    finishPolygonDrawing: rawFinishPolygonDrawing,
    editPolygonVertices: rawEditPolygonVertices,
    adjustActiveVertex: rawAdjustActiveVertex,
    deleteActiveVertex: rawDeleteActiveVertex,
    selectVertexAtPosition,
    getTempPolygon,
    getTempPoints,
    isMagneticMode,
    setIsMagneticMode,
    magneticThreshold,
    setMagneticThreshold,
    handlePolygonVertexMouseDown,
    clearVertexSelection,
  } = usePolygonCropper(
    fabricCanvasRef,
    setDrawingObject,
    triggerAutoCrop,
    setActiveVertices,
    isDrawingPolygon,
    setIsDrawingPolygon,
    setCroppingMode,
    clearDrawingListeners
  );

  const getCurrentSnapshot = useCallback((): SerializedCropperState => {
    const canvas = fabricCanvasRef.current;
    let shapeObj = drawingObject;
    if (canvas && (!shapeObj || !canvas.getObjects().includes(shapeObj))) {
      shapeObj =
        canvas.getActiveObject() || canvas.getObjects().find((obj) => obj.isCroppingShape) || null;
    }
    return serializeCropperState(
      canvas,
      isDrawingPolygonRef.current,
      getTempPoints(),
      croppingModeRef.current,
      shapeObj
    );
  }, [fabricCanvasRef, drawingObject, getTempPoints]);

  const recordState = useCallback(() => {
    saveState(getCurrentSnapshot());
  }, [saveState, getCurrentSnapshot]);

  const { enableFreehand, disableFreehand } = useFreehandCropper(
    fabricCanvasRef,
    setDrawingObject,
    triggerAutoCrop,
    pathSmoothing
  );
  const {
    startDrawing,
    updateDrawing,
    finishDrawing,
    adjustCroppingShape: rawAdjustCroppingShape,
  } = useBasicShapeCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, adjustmentAmount);

  const startDrawingSnapshotRef = useRef<SerializedCropperState | null>(null);
  const dragStartSnapshotRef = useRef<SerializedCropperState | null>(null);

  const startCropping = useCallback(
    (mode: CroppingMode, initialPolygonPoints: CropPoint[] = []) => {
      setCroppingMode(mode);
      setDrawingObject(null);
      setIsDrawingPolygon(mode === 'polygon');

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      canvas.getObjects().forEach((obj) => {
        if (obj.isDrawingTemp || obj.isDrawingTempCircle) canvas.remove(obj);
      });

      clearAllListeners();

      disableFreehand();

      const handleSelection = (e: any) => {
        if (e.selected && e.selected.length > 0) {
          const obj = e.selected[0];
          if (obj.isCroppingShape) {
            setDrawingObject(obj);
          }
        } else if (!canvas.getActiveObject()) {
          setDrawingObject(null);
        }
      };

      globalUnsubsRef.current.push(
        canvas.on('selection:created', handleSelection),
        canvas.on('selection:updated', handleSelection),
        canvas.on('selection:cleared', handleSelection),
        canvas.on('object:moving', (e: any) => {
          const target = e.target;
          if (!target) return;

          if (target.isDrawingTempCircle) {
            handlePolygonVertexMoving(target);
          } else if (target.isCroppingShape) {
            clampMoveToImageBounds(target, canvas);
          }
        }),
        canvas.on('object:scaling', ({ target }: any) => {
          if (target && target.isCroppingShape) clampScaleToImageBounds(target, canvas);
        }),
        canvas.on('object:modified', ({ target }: any) => {
          if (target) delete target._orig;
          if (dragStartSnapshotRef.current) {
            saveState(dragStartSnapshotRef.current);
            dragStartSnapshotRef.current = null;
          }
          if (target && (target.isCroppingShape || target.isDrawingTempCircle)) triggerAutoCrop();
        })
      );

      if (mode === 'polygon') {
        startPolygonDrawing(initialPolygonPoints);
      } else if (mode === 'path' || mode === 'freehand') {
        enableFreehand();
        drawingUnsubsRef.current.push(
          canvas.on('path:created', () => {
            if (startDrawingSnapshotRef.current) {
              saveState(startDrawingSnapshotRef.current);
              startDrawingSnapshotRef.current = null;
            }
          })
        );
      }

      let startPoint: any = null;
      let currentShape: FabricObject | null = null;

      drawingUnsubsRef.current.push(
        canvas.on('mouse:down', (options: any) => {
          if (!imageLoaded) return;

          if (
            !options.target ||
            (!options.target.isCroppingShape && !options.target.isDrawingTempCircle)
          ) {
            startDrawingSnapshotRef.current = getCurrentSnapshot();
          }

          if (options.target && options.target.isCroppingShape) {
            dragStartSnapshotRef.current = getCurrentSnapshot();
            return;
          }

          const pointer = (canvas as any).getPointer(options.e);

          if (mode === 'polygon') {
            if (options.target && options.target.isDrawingTempCircle) {
              dragStartSnapshotRef.current = getCurrentSnapshot();
              handlePolygonVertexMouseDown(options.target, options.e);
            } else {
              saveState(getCurrentSnapshot());
              clearVertexSelection(options.e);
              handlePolygonMouseDown(pointer, options.target);
            }
          } else if (mode === 'rect' || mode === 'circle') {
            startPoint = pointer;
            currentShape = startDrawing(mode, startPoint);
            canvas.add(currentShape);
            setDrawingObject(currentShape);
          }
        }),
        canvas.on('mouse:move', (options: any) => {
          const pointer = (canvas as any).getPointer(options.e);
          if (mode === 'rect' || mode === 'circle') {
            updateDrawing(mode, currentShape, startPoint, pointer);
            canvas.renderAll();
          } else if (mode === 'polygon') {
            handlePolygonMouseMove(pointer);
          }
        }),
        canvas.on('mouse:up', () => {
          if (mode === 'rect' || mode === 'circle') {
            if (startDrawingSnapshotRef.current && currentShape) {
              saveState(startDrawingSnapshotRef.current);
              startDrawingSnapshotRef.current = null;
            }
            finishDrawing(currentShape, canvas);
            currentShape = null;
          } else if (mode === 'polygon') {
            handlePolygonMouseUp();
            if (dragStartSnapshotRef.current) {
              saveState(dragStartSnapshotRef.current);
              dragStartSnapshotRef.current = null;
            }
          } else if (dragStartSnapshotRef.current) {
            saveState(dragStartSnapshotRef.current);
            dragStartSnapshotRef.current = null;
          }
        })
      );
    },
    [
      fabricCanvasRef,
      imageLoaded,
      disableFreehand,
      startPolygonDrawing,
      enableFreehand,
      handlePolygonMouseDown,
      handlePolygonMouseMove,
      handlePolygonMouseUp,
      startDrawing,
      updateDrawing,
      finishDrawing,
      handlePolygonVertexMoving,
      triggerAutoCrop,
      handlePolygonVertexMouseDown,
      clearVertexSelection,
      getCurrentSnapshot,
      saveState,
      clearAllListeners,
    ]
  );

  const finishPolygonDrawing = useCallback(() => {
    recordState();
    rawFinishPolygonDrawing();
  }, [recordState, rawFinishPolygonDrawing]);

  const editPolygonVertices = useCallback(() => {
    recordState();
    rawEditPolygonVertices(drawingObject, startCropping);
  }, [drawingObject, rawEditPolygonVertices, startCropping, recordState]);

  const deleteActiveVertex = useCallback(() => {
    recordState();
    rawDeleteActiveVertex(startCropping);
  }, [rawDeleteActiveVertex, startCropping, recordState]);

  const deleteActiveShape = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      recordState();
      activeObjects.forEach((obj) => {
        if (obj.isCroppingShape) canvas.remove(obj);
      });
      canvas.discardActiveObject();
      setDrawingObject(null);
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, triggerAutoCrop, recordState]);

  const reset = useCallback(() => {
    recordState();
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.getObjects().forEach((obj) => canvas.remove(obj));
      clearAllListeners();
      canvas.isDrawingMode = false;
    }
    setCroppedImageUrl?.(null);
    setCroppingMode(null);
    setDrawingObject(null);
    setIsDrawingPolygon(false);
    setActiveVertices([]);
    startPolygonDrawing([]);
  }, [fabricCanvasRef, setCroppedImageUrl, startPolygonDrawing, recordState, clearAllListeners]);

  const wrappedAdjustCroppingShape = useCallback(
    (side: 'top' | 'bottom' | 'left' | 'right', direction: number) => {
      recordState();
      rawAdjustCroppingShape(drawingObject, side, direction);
    },
    [rawAdjustCroppingShape, drawingObject, recordState]
  );

  const adjustActiveVertex = useCallback(
    (dx: number, dy: number) => {
      recordState();
      rawAdjustActiveVertex(dx, dy);
    },
    [rawAdjustActiveVertex, recordState]
  );

  const handleUndo = useCallback(() => {
    undo(getCurrentSnapshot(), (prevState) => {
      restoreCropperState(prevState, fabricCanvasRef.current, {
        setCroppingMode,
        setIsDrawingPolygon,
        setDrawingObject,
        startPolygonDrawing,
        triggerAutoCrop,
        setCroppedImageUrl,
      });
    });
  }, [
    undo,
    getCurrentSnapshot,
    fabricCanvasRef,
    setCroppingMode,
    setIsDrawingPolygon,
    setDrawingObject,
    startPolygonDrawing,
    triggerAutoCrop,
    setCroppedImageUrl,
  ]);

  const handleRedo = useCallback(() => {
    redo(getCurrentSnapshot(), (nextState) => {
      restoreCropperState(nextState, fabricCanvasRef.current, {
        setCroppingMode,
        setIsDrawingPolygon,
        setDrawingObject,
        startPolygonDrawing,
        triggerAutoCrop,
        setCroppedImageUrl,
      });
    });
  }, [
    redo,
    getCurrentSnapshot,
    fabricCanvasRef,
    setCroppingMode,
    setIsDrawingPolygon,
    setDrawingObject,
    startPolygonDrawing,
    triggerAutoCrop,
    setCroppedImageUrl,
  ]);

  return {
    croppingMode,
    drawingObject,
    isDrawingPolygon,
    autoCropCount,
    activeVertices,
    isMagneticMode,
    setIsMagneticMode,
    magneticThreshold,
    setMagneticThreshold,
    startCropping,
    finishPolygonDrawing,
    editPolygonVertices,
    adjustCroppingShape: wrappedAdjustCroppingShape,
    adjustActiveVertex,
    deleteActiveVertex,
    deleteActiveShape,
    getTempPolygon,
    selectVertexAtPosition,
    reset,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
