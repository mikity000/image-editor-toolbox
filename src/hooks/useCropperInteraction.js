import { useState, useCallback, useRef } from 'react';
import { Rect, Circle, Polygon, Line, Point, util, PencilBrush } from 'fabric';
import { clampMoveToImageBounds, clampScaleToImageBounds, clampPointToImageBounds } from '../utils/fabricBounds';

export function useCropperInteraction(fabricCanvasRef, imageLoaded, setCroppedImageUrl, pathSmoothing = 8) {
  const [croppingMode, setCroppingMode] = useState(null);
  const [drawingObject, setDrawingObject] = useState(null);
  const polygonPointsRef = useRef([]);
  const tempPointsRef = useRef([]);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [adjustmentAmount] = useState(1); // 調整量（固定）
  const [autoCropCount, setAutoCropCount] = useState(0);

  const triggerAutoCrop = useCallback(() => setAutoCropCount(c => c + 1), []);

  const startCropping = useCallback((mode, initialPolygonPoints = []) => {
    setCroppingMode(mode);
    setDrawingObject(null);
    polygonPointsRef.current = initialPolygonPoints;
    setIsDrawingPolygon(mode === 'polygon');

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.getObjects().forEach(obj => canvas.remove(obj));
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

    const handleSelection = (e) => {
      if (e.deselected) {
        e.deselected.forEach(obj => {
          if (obj.isDrawingTempCircle) {
            obj.set({ fill: 'red', strokeWidth: 0, radius: 5 });
          }
        });
      }
      if (e.selected) {
        e.selected.forEach(obj => {
          if (obj.isDrawingTempCircle) {
            obj.set({ fill: '#ffc107', strokeWidth: 2, stroke: '#000', radius: 5 });
          }
        });
      }
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelection);

    let startPoint;
    let currentShape;
    let tempPoints = [];
    tempPointsRef.current = tempPoints;

    if (mode === 'polygon' && initialPolygonPoints.length > 0) {
       initialPolygonPoints.forEach((p, index) => {
          const ptObj = { x: p.x, y: p.y };
          tempPoints.push(ptObj);
          if (index > 0) {
             const prev = tempPoints[index - 1];
             const line = new Line([prev.x, prev.y, p.x, p.y], {
                 stroke: 'red', strokeWidth: 2, selectable: false, evented: false, isDrawingTemp: true
             });
             prev.lineOut = line;
             ptObj.lineIn = line;
             canvas.add(line);
          }
          const circle = new Circle({
              radius: 5, fill: 'red', left: p.x - 5, top: p.y - 5,
              selectable: true, evented: true, hasControls: false, hasBorders: false, hoverCursor: 'pointer',
              isDrawingTemp: true, isDrawingTempCircle: true, pointIndex: index
          });
          ptObj.circle = circle;
          canvas.add(circle);
       });
    }

    canvas.on('object:moving', (e) => {
      const target = e.target;
      if (!target) return;
      if (target.isDrawingTempCircle) {
         const cx = target.left + target.radius;
         const cy = target.top + target.radius;
         const clamped = clampPointToImageBounds({ x: cx, y: cy }, canvas);
         
         target.set({ left: clamped.x - target.radius, top: clamped.y - target.radius });
         target.setCoords();

         const idx = target.pointIndex;
         const pt = tempPoints[idx];
         if (!pt) return;
         pt.x = clamped.x;
         pt.y = clamped.y;
         if (pt.lineIn) pt.lineIn.set({ x2: pt.x, y2: pt.y });
         if (pt.lineOut) pt.lineOut.set({ x1: pt.x, y1: pt.y });
         polygonPointsRef.current = tempPoints.map(p => ({ x: p.x, y: p.y }));
         canvas.renderAll();
      } else if (target.isCroppingShape) {
         clampMoveToImageBounds(target, canvas);
      }
    });

    canvas.on('object:scaling', ({ target }) => { if (target && target.isCroppingShape) clampScaleToImageBounds(target, canvas); });
    canvas.on('object:modified', ({ target }) => { 
      if (target) delete target._orig; 
      if (target && (target.isCroppingShape || target.isDrawingTempCircle)) triggerAutoCrop();
    });

    canvas.isDrawingMode = (mode === 'path');
    if (mode === 'path') {
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.color = 'red';
      canvas.freeDrawingBrush.width = 2;
      canvas.freeDrawingBrush.decimate = pathSmoothing;

      canvas.on('path:created', (opt) => {
        const pathObj = opt.path;
        canvas.isDrawingMode = false;
        pathObj.set({
          fill: 'transparent',
          stroke: 'red',
          strokeWidth: 1,
          strokeUniform: true,
          borderColor: 'red',
          cornerColor: 'green',
          cornerSize: 10,
          transparentCorners: false,
          isCroppingShape: true
        });
        pathObj.setControlsVisibility({ mtr: false });
        setDrawingObject(pathObj);
        canvas.setActiveObject(pathObj);
        triggerAutoCrop();
      });
      return;
    }

    canvas.on('mouse:down', (options) => {
      if (!imageLoaded) return;
      const hasCroppingShape = canvas.getObjects().some(o => o.isCroppingShape);
      if (hasCroppingShape) return;

      const pointer = canvas.getPointer(options.e);

      if (mode === 'polygon') {
        const target = options.target;
        if (target && target.isDrawingTempCircle) return;
        
        const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
        const ptObj = { x: clampedPointer.x, y: clampedPointer.y };
        tempPoints.push(ptObj);
        const index = tempPoints.length - 1;
        if (index > 0) {
            const prevPoint = tempPoints[index - 1];
            const line = new Line([prevPoint.x, prevPoint.y, ptObj.x, ptObj.y], {
                stroke: 'red', strokeWidth: 2, selectable: false, evented: false, isDrawingTemp: true
            });
            prevPoint.lineOut = line;
            ptObj.lineIn = line;
            canvas.add(line);
        }
        const circle = new Circle({
            radius: 5, fill: 'red', left: clampedPointer.x - 5, top: clampedPointer.y - 5,
            selectable: true, evented: true, hasControls: false, hasBorders: false, hoverCursor: 'pointer',
            isDrawingTemp: true, isDrawingTempCircle: true, pointIndex: index
        });
        ptObj.circle = circle;
        canvas.add(circle);
        
        polygonPointsRef.current = tempPoints.map(p => ({ x: p.x, y: p.y }));
        return;
      }

      startPoint = pointer;
      currentShape = mode === 'rect' ? new Rect({ width: 0, height: 0 }) : new Circle({ radius: 0 });
      currentShape.set({
        left: startPoint.x, top: startPoint.y, fill: 'transparent', stroke: 'red', strokeWidth: 1,
        strokeUniform: true, borderColor: 'red', cornerColor: 'green', cornerSize: 10,
        transparentCorners: false, hasControls: true, hasBorders: true, isCroppingShape: true
      });
      currentShape.setControlsVisibility({ mtr: false });
      canvas.add(currentShape);
      setDrawingObject(currentShape);
    });

    canvas.on('mouse:move', (options) => {
      if (!currentShape || mode === 'polygon') return;
      const pointer = canvas.getPointer(options.e);
      if (mode === 'rect') {
        currentShape.set({
          width: Math.abs(pointer.x - startPoint.x), height: Math.abs(pointer.y - startPoint.y),
          left: Math.min(pointer.x, startPoint.x), top: Math.min(pointer.y, startPoint.y),
        });
      } else if (mode === 'circle') {
        const radius = Math.max(Math.abs(pointer.x - startPoint.x), Math.abs(pointer.y - startPoint.y)) / 2;
        currentShape.set({ radius: radius, left: startPoint.x - radius, top: startPoint.y - radius });
      }
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      if (currentShape && mode !== 'polygon') {
        currentShape.setCoords();
        setDrawingObject(currentShape);
        currentShape = null;
        triggerAutoCrop();
      }
    });
  }, [imageLoaded, fabricCanvasRef, pathSmoothing, triggerAutoCrop]);

  const finishPolygonDrawing = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || polygonPointsRef.current.length < 3) {
      alert('多角形を描くには最低3つの頂点が必要です。');
      return;
    }

    const objects = canvas.getObjects();
    objects.forEach(obj => { if (obj.isDrawingTemp) canvas.remove(obj); });

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
    triggerAutoCrop();
  }, [fabricCanvasRef, triggerAutoCrop]);

  const editPolygonVertices = useCallback(() => {
    if (!drawingObject || drawingObject.type !== 'polygon') return;
    const matrix = drawingObject.calcTransformMatrix();
    const absolutePoints = drawingObject.points.map(p => {
        const pathOffsetX = drawingObject.pathOffset ? drawingObject.pathOffset.x : 0;
        const pathOffsetY = drawingObject.pathOffset ? drawingObject.pathOffset.y : 0;
        const localPoint = new Point(p.x - pathOffsetX, p.y - pathOffsetY);
        const absPoint = util.transformPoint(localPoint, matrix);
        return { x: absPoint.x, y: absPoint.y };
    });
    startCropping('polygon', absolutePoints);
  }, [drawingObject, startCropping]);

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
      polygonPointsRef.current = tempPointsRef.current.map(p => ({ x: p.x, y: p.y }));
      canvas.renderAll();
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, triggerAutoCrop]);

  const deleteActiveVertex = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.isDrawingTempCircle) {
      if (tempPointsRef.current.length <= 3) {
        alert('多角形として成立させるため、最低3つの頂点が必要です。');
        return;
      }
      const idx = activeObj.pointIndex;
      const updatedPoints = tempPointsRef.current
        .filter((_, i) => i !== idx)
        .map(p => ({ x: p.x, y: p.y }));
      
      startCropping('polygon', updatedPoints);
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, startCropping, triggerAutoCrop]);

  const adjustCroppingShape = useCallback((side, direction) => {
    if (!drawingObject) return;
    const canvas = fabricCanvasRef.current;
    const amount = adjustmentAmount * direction;

    let scaleX = drawingObject.scaleX || 1;
    let scaleY = drawingObject.scaleY || 1;
    let left = drawingObject.left;
    let top = drawingObject.top;

    // オブジェクトのベースとなる幅と高さを取得（スケール前の純粋なサイズ）
    const baseW = drawingObject.width || (drawingObject.rx ? drawingObject.rx * 2 : drawingObject.radius * 2);
    const baseH = drawingObject.height || (drawingObject.ry ? drawingObject.ry * 2 : drawingObject.radius * 2);

    if (!baseW || !baseH) return;

    // amountピクセル変化させるために必要なスケールの変化量
    const deltaScaleX = amount / baseW;
    const deltaScaleY = amount / baseH;

    switch (side) {
      case 'top': 
        top -= amount; 
        scaleY += deltaScaleY; 
        break;
      case 'bottom': 
        scaleY += deltaScaleY; 
        break;
      case 'left': 
        left -= amount; 
        scaleX += deltaScaleX; 
        break;
      case 'right': 
        scaleX += deltaScaleX; 
        break;
      default: return;
    }

    // 新しいスケールが極端に小さくならないようにする（例: 最小サイズ10pxを維持）
    if (baseW * scaleX < 10) scaleX = 10 / baseW;
    if (baseH * scaleY < 10) scaleY = 10 / baseH;

    drawingObject.set({ left, top, scaleX, scaleY });
    
    // setActiveObjectやsetの後にCoordsを更新させる
    const activeObj = canvas.getActiveObject() || drawingObject;
    if (activeObj) activeObj.setCoords();
    canvas.renderAll();
    triggerAutoCrop();
  }, [drawingObject, adjustmentAmount, fabricCanvasRef, triggerAutoCrop]);

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
    polygonPointsRef.current = [];
    setIsDrawingPolygon(false);
  }, [fabricCanvasRef, setCroppedImageUrl]);

  return {
    croppingMode, drawingObject, isDrawingPolygon, autoCropCount,
    startCropping, finishPolygonDrawing, editPolygonVertices, adjustCroppingShape, adjustActiveVertex, deleteActiveVertex, getTempPolygon, reset
  };
}
