import { useState, useCallback, useRef } from 'react';
import { Rect, Circle, Polygon, Line, Point, util, PencilBrush } from 'fabric';
import { clampMoveToImageBounds, clampScaleToImageBounds, clampPointToImageBounds } from '../utils/fabricBounds';

const getDistanceToSegment = (p, v, w) => {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.sqrt(Math.pow(p.x - projX, 2) + Math.pow(p.y - projY, 2));
};

export function useCropperInteraction(fabricCanvasRef, imageLoaded, setCroppedImageUrl, pathSmoothing = 8) {
  const [croppingMode, setCroppingMode] = useState(null);
  const [drawingObject, setDrawingObject] = useState(null);
  const polygonPointsRef = useRef([]);
  const tempPointsRef = useRef([]);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [adjustmentAmount] = useState(1);
  const [autoCropCount, setAutoCropCount] = useState(0);
  const [activeVertexPos, setActiveVertexPos] = useState(null);

  const triggerAutoCrop = useCallback(() => setAutoCropCount(c => c + 1), []);

  const startCropping = useCallback((mode, initialPolygonPoints = []) => {
    setCroppingMode(mode);
    setDrawingObject(null);
    polygonPointsRef.current = initialPolygonPoints;
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

    const handleSelection = (e) => {
      if (e.deselected) {
        e.deselected.forEach(obj => {
          if (obj.isDrawingTempCircle) {
            obj.set({ fill: 'red', strokeWidth: 0, radius: 5 });
            setActiveVertexPos(null);
          }
        });
      }
      if (e.selected && e.selected.length > 0) {
        const obj = e.selected[0];
        if (obj.isCroppingShape) {
          setDrawingObject(obj);
        }
        e.selected.forEach(obj => {
          if (obj.isDrawingTempCircle) {
            obj.set({ fill: '#32cd32', strokeWidth: 1, stroke: '#000', radius: 5 });
            if (tempPointsRef.current && tempPointsRef.current.length >= 3) {
              const cx = obj.left + obj.radius;
              const cy = obj.top + obj.radius;
              setActiveVertexPos({ x: cx, y: cy });
            }
          }
        });
      } else if (!canvas.getActiveObject()) {
        setDrawingObject(null);
      }
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelection);

    let startPoint;
    let currentShape;
    let tempPoints = [];
    tempPointsRef.current = tempPoints;

    const rebuildTempShapes = () => {
      canvas.getObjects().forEach(obj => { if (obj.isDrawingTemp) canvas.remove(obj); });
      
      tempPoints.forEach(p => {
        p.lineIn = null; p.lineOut = null; p.circle = null; p.closingLine = null; p.closingLineIn = null;
      });

      tempPoints.forEach((p, index) => {
        if (index > 0) {
          const prev = tempPoints[index - 1];
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

      if (tempPoints.length >= 3) {
        const first = tempPoints[0];
        const last = tempPoints[tempPoints.length - 1];
        const line = new Line([last.x, last.y, first.x, first.y], {
            stroke: 'red', strokeWidth: 2, strokeDashArray: [5, 5], selectable: false, evented: false, isDrawingTemp: true
        });
        last.closingLine = line;
        first.closingLineIn = line;
        canvas.add(line);
      }

      polygonPointsRef.current = tempPoints.map(p => ({ x: p.x, y: p.y }));
    };

    if (mode === 'polygon' && initialPolygonPoints.length > 0) {
       tempPoints = initialPolygonPoints.map(p => ({ x: p.x, y: p.y }));
       tempPointsRef.current = tempPoints;
       rebuildTempShapes();
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
         if (pt.closingLine) pt.closingLine.set({ x1: pt.x, y1: pt.y });
         if (pt.closingLineIn) pt.closingLineIn.set({ x2: pt.x, y2: pt.y });
         polygonPointsRef.current = tempPoints.map(p => ({ x: p.x, y: p.y }));
         
         if (tempPointsRef.current && tempPointsRef.current.length >= 3) {
            const cx = target.left + target.radius;
            const cy = target.top + target.radius;
            setActiveVertexPos({ x: cx, y: cy });
         }
         
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
      if (options.target && options.target.isCroppingShape) return;

      const pointer = canvas.getPointer(options.e);

      if (mode === 'polygon') {
        const target = options.target;
        if (target && target.isDrawingTempCircle) return;
        
        const clampedPointer = clampPointToImageBounds({ x: pointer.x, y: pointer.y }, canvas);
        const ptObj = { x: clampedPointer.x, y: clampedPointer.y };
        
        let insertIndex = tempPoints.length; // デフォルトは末尾に追加

        if (tempPoints.length >= 2) {
          let minDist = 10; // しきい値
          for (let i = 0; i < tempPoints.length; i++) {
            // 頂点が2つしかない場合、閉じる線は存在しないのでスキップ
            if (i === tempPoints.length - 1 && tempPoints.length < 3) continue;

            const p1 = tempPoints[i];
            const p2 = tempPoints[(i + 1) % tempPoints.length];
            const d = getDistanceToSegment(clampedPointer, p1, p2);
            if (d < minDist) {
              minDist = d;
              insertIndex = i + 1;
            }
          }
        }

        tempPoints.splice(insertIndex, 0, ptObj);
        rebuildTempShapes();
        if (tempPoints.length >= 3) {
          triggerAutoCrop();
        }
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
        canvas.setActiveObject(currentShape);
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

    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.remove(drawingObject);
    }

    startCropping('polygon', absolutePoints);
  }, [drawingObject, startCropping, fabricCanvasRef]);

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
      
      if (tempPointsRef.current && tempPointsRef.current.length >= 3) {
        const finalCx = activeObj.left + activeObj.radius;
        const finalCy = activeObj.top + activeObj.radius;
        setActiveVertexPos({ x: finalCx, y: finalCy });
      }

      canvas.renderAll();
      triggerAutoCrop();
    }
  }, [fabricCanvasRef, triggerAutoCrop]);

  const deleteActiveVertex = useCallback(() => {
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
  }, [fabricCanvasRef, startCropping, triggerAutoCrop]);

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

  const adjustCroppingShape = useCallback((side, direction) => {
    if (!drawingObject) return;
    const canvas = fabricCanvasRef.current;
    const amount = adjustmentAmount * direction;

    let scaleX = drawingObject.scaleX || 1;
    let scaleY = drawingObject.scaleY || 1;
    let left = drawingObject.left;
    let top = drawingObject.top;

    const oldScaleX = scaleX;
    const oldScaleY = scaleY;
    const oldLeft = left;
    const oldTop = top;

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

    // 操作した辺が画像領域外にはみ出した場合、操作を元に戻す
    const image = canvas.backgroundImage;
    if (image) {
      const bounds = drawingObject.getBoundingRect();
      const imgLeft = image.left;
      const imgTop = image.top;
      const imgRight = imgLeft + image.getScaledWidth();
      const imgBottom = imgTop + image.getScaledHeight();
      const epsilon = 1.5; // 移動処理のバッファ(1px) + ストローク分(0.5px) に合わせる

      let outOfBounds = false;

      // 操作した辺だけをチェックする
      switch (side) {
        case 'left':
          if (bounds.left < imgLeft - epsilon) outOfBounds = true;
          break;
        case 'right':
          if (bounds.left + bounds.width > imgRight + epsilon) outOfBounds = true;
          break;
        case 'top':
          if (bounds.top < imgTop - epsilon) outOfBounds = true;
          break;
        case 'bottom':
          if (bounds.top + bounds.height > imgBottom + epsilon) outOfBounds = true;
          break;
      }

      if (outOfBounds) {
        drawingObject.set({ left: oldLeft, top: oldTop, scaleX: oldScaleX, scaleY: oldScaleY });
        if (activeObj) activeObj.setCoords();
      }
    }

    canvas.renderAll();
    triggerAutoCrop();
  }, [drawingObject, adjustmentAmount, fabricCanvasRef, triggerAutoCrop]);

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

    // しきい値（半径20ピクセル以内）を満たす場合のみ選択
    if (closestCircle && minDistance <= 20) {
      canvas.setActiveObject(closestCircle);
      canvas.renderAll();
    }
  }, [fabricCanvasRef]);

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
    croppingMode, drawingObject, isDrawingPolygon, autoCropCount, activeVertexPos,
    startCropping, finishPolygonDrawing, editPolygonVertices, adjustCroppingShape, adjustActiveVertex, deleteActiveVertex, deleteActiveShape, getTempPolygon, selectVertexAtPosition, reset
  };
}
