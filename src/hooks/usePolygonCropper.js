import { useRef, useCallback } from 'react';
import { Polygon, Line, Circle, Point, util } from 'fabric';
import { clampPointToImageBounds } from '../utils/fabricBounds';

const getDistanceToSegment = (p, v, w) => {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.sqrt(Math.pow(p.x - projX, 2) + Math.pow(p.y - projY, 2));
};

export function usePolygonCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, setActiveVertexPos, setIsDrawingPolygon, setCroppingMode) {
  const polygonPointsRef = useRef([]);
  const tempPointsRef = useRef([]);

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
          isDrawingTemp: true, isDrawingTempCircle: true, pointIndex: index
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

  const startPolygonDrawing = useCallback((initialPoints = []) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (initialPoints.length > 0) {
      tempPointsRef.current = initialPoints.map(p => ({ x: p.x, y: p.y }));
      rebuildTempShapes(canvas);
    } else {
      tempPointsRef.current = [];
      polygonPointsRef.current = [];
    }
  }, [fabricCanvasRef, rebuildTempShapes]);

  const handlePolygonMouseDown = useCallback((pointer, target) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    if (target && target.isDrawingTempCircle) return;
    
    const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
    const ptObj = { x: clampedPointer.x, y: clampedPointer.y };
    
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
    if (tempPointsRef.current.length >= 3) {
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, rebuildTempShapes, triggerAutoCrop]);

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
    startPolygonDrawing, handlePolygonMouseDown, handlePolygonVertexMoving,
    finishPolygonDrawing, editPolygonVertices, adjustActiveVertex, deleteActiveVertex, selectVertexAtPosition, getTempPolygon
  };
}
