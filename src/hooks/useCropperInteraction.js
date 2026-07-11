import { useState, useCallback } from 'react';
import { clampMoveToImageBounds, clampScaleToImageBounds } from '../utils/fabricBounds';
import { usePolygonCropper } from './usePolygonCropper';
import { useFreehandCropper } from './useFreehandCropper';
import { useBasicShapeCropper } from './useBasicShapeCropper';

export function useCropperInteraction(fabricCanvasRef, imageLoaded, setCroppedImageUrl, pathSmoothing = 8) {
  const [croppingMode, setCroppingMode] = useState(null);
  const [drawingObject, setDrawingObject] = useState(null);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [adjustmentAmount] = useState(1);
  const [autoCropCount, setAutoCropCount] = useState(0);
  const [activeVertices, setActiveVertices] = useState([]);

  const triggerAutoCrop = useCallback(() => setAutoCropCount(c => c + 1), []);

  const {
    startPolygonDrawing, handlePolygonMouseDown, handlePolygonMouseMove, handlePolygonVertexMoving,
    finishPolygonDrawing, editPolygonVertices: rawEditPolygonVertices,
    adjustActiveVertex, deleteActiveVertex: rawDeleteActiveVertex,
    selectVertexAtPosition, getTempPolygon,
    isMagneticMode, setIsMagneticMode, magneticThreshold, setMagneticThreshold,
    handlePolygonVertexMouseDown, clearVertexSelection
  } = usePolygonCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, setActiveVertices, isDrawingPolygon, setIsDrawingPolygon, setCroppingMode);

  const { enableFreehand, disableFreehand } = useFreehandCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, pathSmoothing);

  const { startDrawing, updateDrawing, finishDrawing, adjustCroppingShape } = useBasicShapeCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, adjustmentAmount);

  const startCropping = useCallback((mode, initialPolygonPoints = []) => {
    setCroppingMode(mode);
    setDrawingObject(null);
    setIsDrawingPolygon(mode === 'polygon');

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.getObjects().forEach(obj => {
      if (obj.isDrawingTemp || obj.isDrawingTempCircle) canvas.remove(obj);
    });

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    canvas.off('object:moving');
    canvas.off('object:scaling');
    canvas.off('object:modified');
    canvas.off('path:created');
    canvas.off('selection:created');
    canvas.off('selection:updated');
    canvas.off('selection:cleared');

    disableFreehand();

    const handleSelection = (e) => {
      if (e.selected && e.selected.length > 0) {
        const obj = e.selected[0];
        if (obj.isCroppingShape) {
          setDrawingObject(obj);
        }
      } else if (!canvas.getActiveObject()) {
        setDrawingObject(null);
      }
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelection);

    if (mode === 'polygon') {
      startPolygonDrawing(initialPolygonPoints);
    } else if (mode === 'path') {
      enableFreehand();
    }

    let startPoint = null;
    let currentShape = null;

    canvas.on('mouse:down', (options) => {
      if (!imageLoaded) return;
      if (options.target && options.target.isCroppingShape) return;

      const pointer = canvas.getPointer(options.e);

      if (mode === 'polygon') {
        if (options.target && options.target.isDrawingTempCircle) {
          handlePolygonVertexMouseDown(options.target, options.e);
        } else {
          clearVertexSelection(options.e);
          handlePolygonMouseDown(pointer, options.target);
        }
      } else if (mode === 'rect' || mode === 'circle') {
        startPoint = pointer;
        currentShape = startDrawing(mode, startPoint);
        canvas.add(currentShape);
        setDrawingObject(currentShape);
      }
    });

    canvas.on('mouse:move', (options) => {
      const pointer = canvas.getPointer(options.e);
      if (mode === 'rect' || mode === 'circle') {
        updateDrawing(mode, currentShape, startPoint, pointer);
        canvas.renderAll();
      } else if (mode === 'polygon') {
        handlePolygonMouseMove(pointer);
      }
    });

    canvas.on('mouse:up', () => {
      if (mode === 'rect' || mode === 'circle') {
        finishDrawing(currentShape, canvas);
        currentShape = null;
      }
    });

    canvas.on('object:moving', (e) => {
      const target = e.target;
      if (!target) return;
      
      if (target.isDrawingTempCircle) {
        handlePolygonVertexMoving(target);
      } else if (target.isCroppingShape) {
        clampMoveToImageBounds(target, canvas);
      }
    });

    canvas.on('object:scaling', ({ target }) => { 
      if (target && target.isCroppingShape) clampScaleToImageBounds(target, canvas); 
    });
    
    canvas.on('object:modified', ({ target }) => { 
      if (target) delete target._orig; 
      if (target && (target.isCroppingShape || target.isDrawingTempCircle)) triggerAutoCrop();
    });

  }, [fabricCanvasRef, imageLoaded, disableFreehand, startPolygonDrawing, enableFreehand, handlePolygonMouseDown, handlePolygonMouseMove, startDrawing, updateDrawing, finishDrawing, handlePolygonVertexMoving, triggerAutoCrop, handlePolygonVertexMouseDown, clearVertexSelection]);

  const editPolygonVertices = useCallback(() => {
    rawEditPolygonVertices(drawingObject, startCropping);
  }, [drawingObject, rawEditPolygonVertices, startCropping]);

  const deleteActiveVertex = useCallback(() => {
    rawDeleteActiveVertex(startCropping);
  }, [rawDeleteActiveVertex, startCropping]);

  const deleteActiveShape = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => {
        if (obj.isCroppingShape) canvas.remove(obj);
      });
      canvas.discardActiveObject();
      setDrawingObject(null);
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, triggerAutoCrop]);

  const reset = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.getObjects().forEach(obj => canvas.remove(obj));
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
      canvas.off('path:created');
      canvas.off('selection:created');
      canvas.off('selection:updated');
      canvas.off('selection:cleared');
      canvas.isDrawingMode = false;
    }
    setCroppedImageUrl(null);
    setCroppingMode(null);
    setDrawingObject(null);
    setIsDrawingPolygon(false);
    setActiveVertices([]);
    startPolygonDrawing([]); // Reset points internally
  }, [fabricCanvasRef, setCroppedImageUrl, startPolygonDrawing]);

  const wrappedAdjustCroppingShape = useCallback((side, direction) => {
    adjustCroppingShape(drawingObject, side, direction);
  }, [adjustCroppingShape, drawingObject]);

  return {
    croppingMode, drawingObject, isDrawingPolygon, autoCropCount, activeVertices,
    isMagneticMode, setIsMagneticMode, magneticThreshold, setMagneticThreshold,
    startCropping, finishPolygonDrawing, editPolygonVertices, adjustCroppingShape: wrappedAdjustCroppingShape, adjustActiveVertex, deleteActiveVertex, deleteActiveShape, getTempPolygon, selectVertexAtPosition, reset
  };
}
