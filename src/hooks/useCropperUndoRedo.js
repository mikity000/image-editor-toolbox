import { useRef, useState, useCallback } from 'react';
import { Rect, Circle, Polygon, Path } from 'fabric';
import { APP_CONFIG } from '../constants/Constants';

const MAX_HISTORY_STACK = APP_CONFIG.MAX_HISTORY_STACK;



export function serializeCropperState(fabricCanvas, isDrawingPolygon, tempPoints, croppingMode, drawingObject) {
  const canvas = fabricCanvas;
  const shapesData = [];
  
  if (canvas) {
    const activeObject = canvas.getActiveObject();
    const croppingObjects = canvas.getObjects().filter(obj => obj.isCroppingShape);
    
    croppingObjects.forEach(obj => {
      const shapeItem = {
        type: obj.type,
        left: obj.left,
        top: obj.top,
        width: obj.width,
        height: obj.height,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle || 0,
        skewX: obj.skewX || 0,
        skewY: obj.skewY || 0,
        fill: obj.fill || 'transparent',
        stroke: obj.stroke || 'red',
        strokeWidth: obj.strokeWidth || 1,
        strokeUniform: obj.strokeUniform ?? true,
        borderColor: obj.borderColor || 'red',
        cornerColor: obj.cornerColor || 'green',
        cornerSize: obj.cornerSize || 10,
        transparentCorners: obj.transparentCorners ?? false,
        objectCaching: obj.objectCaching ?? false,
        isCroppingShape: true,
        isSelected: (obj === activeObject || obj === drawingObject),
      };

      if (obj.type === 'polygon' && obj.points) {
        shapeItem.points = obj.points.map(p => ({ x: p.x, y: p.y }));
        shapeItem.pathOffset = obj.pathOffset ? { x: obj.pathOffset.x, y: obj.pathOffset.y } : null;
      } else if (obj.type === 'path' && obj.path) {
        shapeItem.path = JSON.parse(JSON.stringify(obj.path));
      } else if (obj.type === 'circle') {
        shapeItem.radius = obj.radius;
      }

      shapesData.push(shapeItem);
    });
  }

  return {
    croppingMode: croppingMode || null,
    isDrawingPolygon: !!isDrawingPolygon,
    tempPoints: (tempPoints || []).map(p => ({ x: p.x, y: p.y, isSelected: !!p.isSelected })),
    shapesData
  };
}

export function restoreCropperState(
  state,
  fabricCanvas,
  {
    setCroppingMode,
    setIsDrawingPolygon,
    setDrawingObject,
    startPolygonDrawing,
    triggerAutoCrop,
    setCroppedImageUrl
  }
) {
  const canvas = fabricCanvas;
  if (!canvas) return;

  const existingObjects = canvas.getObjects();
  existingObjects.forEach(obj => {
    if (obj.isCroppingShape || obj.isDrawingTemp || obj.isDrawingTempCircle) {
      canvas.remove(obj);
    }
  });

  if (!state) {
    setCroppingMode?.(null);
    setIsDrawingPolygon?.(false);
    setDrawingObject?.(null);
    startPolygonDrawing?.([]);
    setCroppedImageUrl?.(null);
    canvas.renderAll();
    return;
  }

  setCroppingMode?.(state.croppingMode);
  setIsDrawingPolygon?.(state.isDrawingPolygon);

  if (state.isDrawingPolygon && state.tempPoints) {
    setDrawingObject?.(null);
    startPolygonDrawing?.(state.tempPoints);
  } else {
    let activeShapeObj = null;

    if (state.shapesData && state.shapesData.length > 0) {
      state.shapesData.forEach(sd => {
        let newObj = null;
        const baseOpts = {
          left: sd.left,
          top: sd.top,
          width: sd.width,
          height: sd.height,
          scaleX: sd.scaleX,
          scaleY: sd.scaleY,
          angle: sd.angle,
          skewX: sd.skewX,
          skewY: sd.skewY,
          fill: sd.fill || 'transparent',
          stroke: sd.stroke || 'red',
          strokeWidth: sd.strokeWidth || 1,
          strokeUniform: sd.strokeUniform ?? true,
          borderColor: sd.borderColor || 'red',
          cornerColor: sd.cornerColor || 'green',
          cornerSize: sd.cornerSize || 10,
          transparentCorners: sd.transparentCorners ?? false,
          objectCaching: sd.objectCaching ?? false,
          isCroppingShape: true,
        };

        if (sd.type === 'rect') {
          newObj = new Rect(baseOpts);
        } else if (sd.type === 'circle') {
          newObj = new Circle({ ...baseOpts, radius: sd.radius });
        } else if (sd.type === 'polygon') {
          newObj = new Polygon(sd.points, {
            ...baseOpts,
            pathOffset: sd.pathOffset ? { x: sd.pathOffset.x, y: sd.pathOffset.y } : undefined
          });
        } else if (sd.type === 'path') {
          newObj = new Path(sd.path, baseOpts);
        }

        if (newObj) {
          newObj.setControlsVisibility({ mtr: false });
          canvas.add(newObj);
          if (sd.isSelected) {
            activeShapeObj = newObj;
          }
        }
      });
    }

    if (activeShapeObj) {
      canvas.setActiveObject(activeShapeObj);
      setDrawingObject?.(activeShapeObj);
    } else {
      const allShapes = canvas.getObjects().filter(obj => obj.isCroppingShape);
      if (allShapes.length > 0) {
        const lastShape = allShapes[allShapes.length - 1];
        canvas.setActiveObject(lastShape);
        setDrawingObject?.(lastShape);
      } else {
        setDrawingObject?.(null);
        startPolygonDrawing?.([]);
        if (setCroppedImageUrl && (!state.shapesData || state.shapesData.length === 0)) {
          setCroppedImageUrl(null);
        }
      }
    }
  }

  canvas.renderAll();
  triggerAutoCrop?.();
}

export function useCropperUndoRedo() {
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isRestoringRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const saveState = useCallback((state) => {
    if (isRestoringRef.current) return;
    undoStack.current.push(state);
    if (undoStack.current.length > MAX_HISTORY_STACK) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    updateFlags();
  }, [updateFlags]);

  const undo = useCallback(async (currentState, restoreCallback) => {
    if (undoStack.current.length === 0 || isRestoringRef.current) return;
    
    isRestoringRef.current = true;
    try {
      const prevState = undoStack.current.pop();
      redoStack.current.push(currentState);
      if (redoStack.current.length > MAX_HISTORY_STACK) {
        redoStack.current.shift();
      }
      await restoreCallback(prevState);
      updateFlags();
    } finally {
      isRestoringRef.current = false;
    }
  }, [updateFlags]);

  const redo = useCallback(async (currentState, restoreCallback) => {
    if (redoStack.current.length === 0 || isRestoringRef.current) return;

    isRestoringRef.current = true;
    try {
      const nextState = redoStack.current.pop();
      undoStack.current.push(currentState);
      if (undoStack.current.length > MAX_HISTORY_STACK) {
        undoStack.current.shift();
      }
      await restoreCallback(nextState);
      updateFlags();
    } finally {
      isRestoringRef.current = false;
    }
  }, [updateFlags]);

  const clearHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    updateFlags();
  }, [updateFlags]);

  return {
    saveState,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    isRestoringRef
  };
}

