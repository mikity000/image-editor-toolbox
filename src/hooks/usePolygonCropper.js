import { useRef, useCallback, useState, useEffect } from 'react';
import { Polygon, Line, Circle, Point, util } from 'fabric';
import { clampPointToImageBounds } from '../utils/fabricBounds';
import { initEdgeDetectionCanvas, clearEdgeDetectionCanvas, findClosestEdge } from '../utils/edgeDetection';

const getDistanceToSegment = (p, v, w) => {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.sqrt(Math.pow(p.x - projX, 2) + Math.pow(p.y - projY, 2));
};

export function usePolygonCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, setActiveVertexPos, isDrawingPolygon, setIsDrawingPolygon, setCroppingMode) {
  const polygonPointsRef = useRef([]);
  const tempPointsRef = useRef([]);
  
  const [isMagneticMode, setIsMagneticMode] = useState(false);
  const [magneticThreshold, setMagneticThreshold] = useState(80);
  
  const isMagneticModeRef = useRef(isMagneticMode);
  const magneticThresholdRef = useRef(magneticThreshold);
  const magneticPreviewLineRef = useRef(null);
  const magneticPreviewCircleRef = useRef(null);
  const lastPointerRef = useRef(null);

  useEffect(() => { isMagneticModeRef.current = isMagneticMode; }, [isMagneticMode]);
  useEffect(() => { magneticThresholdRef.current = magneticThreshold; }, [magneticThreshold]);

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

  const rebuildTempShapes = useCallback((canvas) => {
    canvas.getObjects().forEach(obj => { if (obj.isDrawingTemp) canvas.remove(obj); });
    
    tempPointsRef.current.forEach(p => {
      p.lineIn = null; p.lineOut = null; p.circle = null; p.closingLine = null; p.closingLineIn = null;
    });

    tempPointsRef.current.forEach((p, index) => {
      if (index > 0) {
        const prev = tempPointsRef.current[index - 1];
        const line = new Line([prev.x, prev.y, p.x, p.y], {
            stroke: 'red', strokeWidth: 2, selectable: false, evented: false, isDrawingTemp: true
        });
        prev.lineOut = line;
        p.lineIn = line;
        canvas.add(line);
      }
      const circle = new Circle({
          radius: 5, fill: 'red', left: p.x - 5, top: p.y - 5,
          selectable: true, evented: true, hasControls: false, hasBorders: false, hoverCursor: 'pointer',
          isDrawingTemp: true, isDrawingTempCircle: true, pointIndex: index, padding: 7
      });
      p.circle = circle;
      canvas.add(circle);
    });

    if (tempPointsRef.current.length >= 3) {
      const first = tempPointsRef.current[0];
      const last = tempPointsRef.current[tempPointsRef.current.length - 1];
      const line = new Line([last.x, last.y, first.x, first.y], {
          stroke: 'red', strokeWidth: 2, strokeDashArray: [5, 5], selectable: false, evented: false, isDrawingTemp: true
      });
      last.closingLine = line;
      first.closingLineIn = line;
      canvas.add(line);
    }

    polygonPointsRef.current = tempPointsRef.current.map(p => ({ x: p.x, y: p.y }));
  }, []);

  const updateMagneticPreview = useCallback((pointer) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isMagneticModeRef.current || tempPointsRef.current.length === 0 || !pointer) return;

    const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
    
    // スナップ計算
    const snapResult = findClosestEdge(clampedPointer.x, clampedPointer.y, 5, magneticThresholdRef.current);
    const targetPoint = snapResult;

    const lastPoint = tempPointsRef.current[tempPointsRef.current.length - 1];

    if (!magneticPreviewLineRef.current) {
        magneticPreviewLineRef.current = new Line([lastPoint.x, lastPoint.y, targetPoint.x, targetPoint.y], {
            stroke: 'cyan', strokeWidth: 2, strokeDashArray: [3, 3], selectable: false, evented: false, isDrawingTemp: true
        });
        canvas.add(magneticPreviewLineRef.current);
    } else {
        magneticPreviewLineRef.current.set({ x1: lastPoint.x, y1: lastPoint.y, x2: targetPoint.x, y2: targetPoint.y });
    }

    if (!magneticPreviewCircleRef.current) {
        magneticPreviewCircleRef.current = new Circle({
            radius: 4, fill: snapResult.snapped ? 'cyan' : 'gray', 
            left: targetPoint.x - 4, top: targetPoint.y - 4,
            selectable: false, evented: false, isDrawingTemp: true
        });
        canvas.add(magneticPreviewCircleRef.current);
    } else {
        magneticPreviewCircleRef.current.set({ 
            left: targetPoint.x - 4, top: targetPoint.y - 4, 
            fill: snapResult.snapped ? 'cyan' : 'gray' 
        });
    }

    canvas.renderAll();
  }, [fabricCanvasRef]);

  const startPolygonDrawing = useCallback((initialPoints = []) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (isMagneticModeRef.current) {
      initEdgeDetectionCanvas(canvas);
    }

    if (initialPoints.length > 0) {
      tempPointsRef.current = initialPoints.map(p => ({ x: p.x, y: p.y }));
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
  }, [fabricCanvasRef, rebuildTempShapes, updateMagneticPreview]);

  const handlePolygonMouseDown = useCallback((pointer, target) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    if (target && target.isDrawingTempCircle) return;
    
    const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
    let ptObj = { x: clampedPointer.x, y: clampedPointer.y };
    
    if (isMagneticModeRef.current) {
      const snapResult = findClosestEdge(clampedPointer.x, clampedPointer.y, 5, magneticThresholdRef.current);
      ptObj = { x: snapResult.x, y: snapResult.y };
    }
    
    let insertIndex = tempPointsRef.current.length; 

    if (tempPointsRef.current.length >= 2) {
      let minDist = 10; 
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

    tempPointsRef.current.splice(insertIndex, 0, ptObj);
    rebuildTempShapes(canvas);
    
    if (magneticPreviewLineRef.current) {
      canvas.remove(magneticPreviewLineRef.current);
      magneticPreviewLineRef.current = null;
    }
    if (magneticPreviewCircleRef.current) {
      canvas.remove(magneticPreviewCircleRef.current);
      magneticPreviewCircleRef.current = null;
    }

    if (tempPointsRef.current.length >= 3) {
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, rebuildTempShapes, triggerAutoCrop]);

  const handlePolygonMouseMove = useCallback((pointer) => {
    lastPointerRef.current = pointer;
    updateMagneticPreview(pointer);
  }, [updateMagneticPreview]);

  const handlePolygonVertexMoving = useCallback((target) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !target.isDrawingTempCircle) return;
    
    const cx = target.left + target.radius;
    const cy = target.top + target.radius;
    const clamped = clampPointToImageBounds({ x: cx, y: cy }, canvas);
    
    target.set({ left: clamped.x - target.radius, top: clamped.y - target.radius });
    target.setCoords();

    const idx = target.pointIndex;
    const pt = tempPointsRef.current[idx];
    if (!pt) return;
    pt.x = clamped.x;
    pt.y = clamped.y;
    if (pt.lineIn) pt.lineIn.set({ x2: pt.x, y2: pt.y });
    if (pt.lineOut) pt.lineOut.set({ x1: pt.x, y1: pt.y });
    if (pt.closingLine) pt.closingLine.set({ x1: pt.x, y1: pt.y });
    if (pt.closingLineIn) pt.closingLineIn.set({ x2: pt.x, y2: pt.y });
    polygonPointsRef.current = tempPointsRef.current.map(p => ({ x: p.x, y: p.y }));
    
    if (tempPointsRef.current.length >= 3) {
      const finalCx = target.left + target.radius;
      const finalCy = target.top + target.radius;
      setActiveVertexPos({ x: finalCx, y: finalCy });
    }
    
    canvas.renderAll();
  }, [fabricCanvasRef, setActiveVertexPos]);

  const finishPolygonDrawing = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || polygonPointsRef.current.length < 3) {
      alert('多角形を描くには最低3つの頂点が必要です。');
      return;
    }

    const objects = canvas.getObjects();
    objects.forEach(obj => { if (obj.isDrawingTemp || obj.isDrawingTempCircle) canvas.remove(obj); });

    if (magneticPreviewLineRef.current) magneticPreviewLineRef.current = null;
    if (magneticPreviewCircleRef.current) magneticPreviewCircleRef.current = null;

    const polygon = new Polygon(polygonPointsRef.current, {
      fill: 'transparent', stroke: 'red', strokeWidth: 1, strokeUniform: true,
      borderColor: 'red', cornerColor: 'green', cornerSize: 10, transparentCorners: false,
      hasControls: true, hasBorders: true, isCroppingShape: true, objectCaching: false
    });
    
    polygon.setControlsVisibility({ mtr: false });
    canvas.add(polygon);
    canvas.setActiveObject(polygon);
    setDrawingObject(polygon);
    setIsDrawingPolygon(false);
    setCroppingMode(null);

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    triggerAutoCrop();
  }, [fabricCanvasRef, setDrawingObject, setIsDrawingPolygon, setCroppingMode, triggerAutoCrop]);

  const editPolygonVertices = useCallback((drawingObject, startCropping) => {
    if (!drawingObject || drawingObject.type !== 'polygon') return;
    const matrix = drawingObject.calcTransformMatrix();
    const absolutePoints = drawingObject.points.map(p => {
        const pathOffsetX = drawingObject.pathOffset ? drawingObject.pathOffset.x : 0;
        const pathOffsetY = drawingObject.pathOffset ? drawingObject.pathOffset.y : 0;
        const localPoint = new Point(p.x - pathOffsetX, p.y - pathOffsetY);
        const absPoint = util.transformPoint(localPoint, matrix);
        return { x: absPoint.x, y: absPoint.y };
    });

    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.remove(drawingObject);
    }

    startCropping('polygon', absolutePoints);
  }, [fabricCanvasRef]);

  const getTempPolygon = useCallback(() => {
    if (tempPointsRef.current && tempPointsRef.current.length >= 3) {
      return new Polygon(tempPointsRef.current.map(p => ({ x: p.x, y: p.y })), {
        absolutePositioned: true
      });
    }
    return null;
  }, []);

  const adjustActiveVertex = useCallback((dx, dy) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.isDrawingTempCircle) {
      const cx = activeObj.left + activeObj.radius + dx;
      const cy = activeObj.top + activeObj.radius + dy;
      const clamped = clampPointToImageBounds({ x: cx, y: cy }, canvas);
      
      activeObj.set({ left: clamped.x - activeObj.radius, top: clamped.y - activeObj.radius });
      activeObj.setCoords();

      const idx = activeObj.pointIndex;
      const pt = tempPointsRef.current[idx];
      if (!pt) return;
      pt.x = clamped.x;
      pt.y = clamped.y;
      if (pt.lineIn) pt.lineIn.set({ x2: pt.x, y2: pt.y });
      if (pt.lineOut) pt.lineOut.set({ x1: pt.x, y1: pt.y });
      if (pt.closingLine) pt.closingLine.set({ x1: pt.x, y1: pt.y });
      if (pt.closingLineIn) pt.closingLineIn.set({ x2: pt.x, y2: pt.y });
      polygonPointsRef.current = tempPointsRef.current.map(p => ({ x: p.x, y: p.y }));
      
      if (tempPointsRef.current.length >= 3) {
        const finalCx = activeObj.left + activeObj.radius;
        const finalCy = activeObj.top + activeObj.radius;
        setActiveVertexPos({ x: finalCx, y: finalCy });
      }

      canvas.renderAll();
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, setActiveVertexPos, triggerAutoCrop]);

  const deleteActiveVertex = useCallback((startCropping) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.isDrawingTempCircle) {
      const idx = activeObj.pointIndex;
      const updatedPoints = tempPointsRef.current
        .filter((_, i) => i !== idx)
        .map(p => ({ x: p.x, y: p.y }));
      
      startCropping('polygon', updatedPoints);
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, triggerAutoCrop]);

  const selectVertexAtPosition = useCallback((x, y) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const circles = canvas.getObjects().filter(obj => obj.isDrawingTempCircle);
    if (circles.length === 0) return;

    let closestCircle = null;
    let minDistance = Infinity;

    circles.forEach(circle => {
      const cx = circle.left + circle.radius;
      const cy = circle.top + circle.radius;
      const dist = Math.sqrt(Math.pow(cx - x, 2) + Math.pow(cy - y, 2));

      if (dist < minDistance) {
        minDistance = dist;
        closestCircle = circle;
      }
    });

    if (closestCircle && minDistance <= 20) {
      canvas.setActiveObject(closestCircle);
      canvas.renderAll();
    }
  }, [fabricCanvasRef]);

  return {
    polygonPointsRef, tempPointsRef,
    isMagneticMode, setIsMagneticMode, magneticThreshold, setMagneticThreshold,
    startPolygonDrawing, handlePolygonMouseDown, handlePolygonMouseMove, handlePolygonVertexMoving,
    finishPolygonDrawing, editPolygonVertices, adjustActiveVertex, deleteActiveVertex, selectVertexAtPosition, getTempPolygon
  };
}
