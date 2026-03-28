import { useState, useCallback } from 'react';
import { Rect, Circle, Ellipse, Polygon, Line, Point, util, PencilBrush } from 'fabric';

export function useCropperInteraction(fabricCanvasRef, imageLoaded, setCroppedImageUrl, pathSmoothing = 8) {
  const [croppingMode, setCroppingMode] = useState(null);
  const [drawingObject, setDrawingObject] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [adjustmentAmount] = useState(1); // 調整量（固定）

  const clampMoveToImageBounds = useCallback((obj) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvas.backgroundImage) return;
    const bg = canvas.backgroundImage;
    const bgLeft = bg.left, bgTop = bg.top;
    const bgRight = bgLeft + bg.getScaledWidth(), bgBottom = bgTop + bg.getScaledHeight();
    const objWidth = obj.getScaledWidth(), objHeight = obj.getScaledHeight();
    
    const clampedLeft = Math.min(Math.max(obj.left, bgLeft), bgRight - objWidth);
    const clampedTop = Math.min(Math.max(obj.top, bgTop), bgBottom - objHeight);
    
    obj.set({ left: clampedLeft, top: clampedTop });
    obj.setCoords();
  }, [fabricCanvasRef]);

  const clampScaleToImageBounds = useCallback((obj) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvas.backgroundImage) return;
    const bg = canvas.backgroundImage;
    const bgLeft = bg.left, bgTop = bg.top;
    const bgWidth = bg.getScaledWidth(), bgHeight = bg.getScaledHeight();
    const bgRight = bgLeft + bgWidth, bgBottom = bgTop + bgHeight;

    if (!obj._orig) {
      obj._orig = {
        left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY,
        width: obj.width, height: obj.height, originX: obj.originX, originY: obj.originY,
        corner: obj.__corner || canvas._currentTransform.corner
      };
    }
    const orig = obj._orig;
    const corner = orig.corner;

    let maxScaleX = bgWidth / orig.width;
    let maxScaleY = bgHeight / orig.height;

    if (corner.includes('b')) maxScaleY = Math.min(maxScaleY, (bgBottom - orig.top) / orig.height);
    if (corner.includes('t')) maxScaleY = Math.min(maxScaleY, (orig.top + orig.height * orig.scaleY - bgTop) / orig.height);
    if (corner.includes('r')) maxScaleX = Math.min(maxScaleX, (bgRight - orig.left) / orig.width);
    if (corner.includes('l')) maxScaleX = Math.min(maxScaleX, (orig.left + orig.width * orig.scaleX - bgLeft) / orig.width);

    const EPS = 1e-8;
    let clampedScaleX = Math.min(obj.scaleX, maxScaleX);
    let clampedScaleY = Math.min(obj.scaleY, maxScaleY);
    if (Math.abs(clampedScaleX - maxScaleX) < EPS) clampedScaleX = maxScaleX;
    if (Math.abs(clampedScaleY - maxScaleY) < EPS) clampedScaleY = maxScaleY;
    
    obj.set({ scaleX: clampedScaleX, scaleY: clampedScaleY });
    const newWidth = obj.getScaledWidth(), newHeight = obj.getScaledHeight();
    const ox = (orig.originX === 'center' ? 0.5 : (orig.originX === 'right' ? 1 : 0));
    const oy = (orig.originY === 'center' ? 0.5 : (orig.originY === 'bottom' ? 1 : 0));
    const origLeftEdge = orig.left - ox * orig.width * orig.scaleX;
    const origTopEdge = orig.top - oy * orig.height * orig.scaleY;
    const origRightEdge = origLeftEdge + orig.width * orig.scaleX;
    const origBottomEdge = origTopEdge + orig.height * orig.scaleY;

    let newLeftEdge = corner.includes('r') && !corner.includes('l') ? origLeftEdge :
                      corner.includes('l') && !corner.includes('r') ? origRightEdge - newWidth : origLeftEdge;
    let newTopEdge = corner.includes('b') && !corner.includes('t') ? origTopEdge :
                     corner.includes('t') && !corner.includes('b') ? origBottomEdge - newHeight : origTopEdge;

    newLeftEdge = Math.min(Math.max(newLeftEdge, bgLeft), bgRight - newWidth);
    newTopEdge = Math.min(Math.max(newTopEdge, bgTop), bgBottom - newHeight);
    
    obj.set({ left: newLeftEdge + ox * newWidth, top: newTopEdge + oy * newHeight });
    obj.setCoords();
  }, [fabricCanvasRef]);

  const startCropping = useCallback((mode, initialPolygonPoints = []) => {
    setCroppingMode(mode);
    setDrawingObject(null);
    setPolygonPoints(initialPolygonPoints);
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
      });
      return;
    }

    let startPoint;
    let currentShape;
    let tempPoints = [];

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
         const idx = target.pointIndex;
         const pt = tempPoints[idx];
         if (!pt) return;
         pt.x = target.left + target.radius;
         pt.y = target.top  + target.radius;
         if (pt.lineIn) pt.lineIn.set({ x2: pt.x, y2: pt.y });
         if (pt.lineOut) pt.lineOut.set({ x1: pt.x, y1: pt.y });
         setPolygonPoints(tempPoints.map(p => ({ x: p.x, y: p.y })));
         canvas.renderAll();
      } else if (target.isCroppingShape) {
         clampMoveToImageBounds(target);
      }
    });

    canvas.on('object:scaling', ({ target }) => { if (target && target.isCroppingShape) clampScaleToImageBounds(target); });
    canvas.on('object:modified', ({ target }) => { if (target) delete target._orig; });

    canvas.on('mouse:down', (options) => {
      if (!imageLoaded) return;
      const hasCroppingShape = canvas.getObjects().some(o => o.isCroppingShape);
      if (hasCroppingShape) return;

      const pointer = canvas.getPointer(options.e);

      if (mode === 'polygon') {
        const target = options.target;
        if (target && target.isDrawingTempCircle) return;
        const ptObj = { x: pointer.x, y: pointer.y };
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
            radius: 5, fill: 'red', left: pointer.x - 5, top: pointer.y - 5,
            selectable: true, evented: true, hasControls: false, hasBorders: false, hoverCursor: 'pointer',
            isDrawingTemp: true, isDrawingTempCircle: true, pointIndex: index
        });
        ptObj.circle = circle;
        canvas.add(circle);
        
        setPolygonPoints(tempPoints.map(p => ({ x: p.x, y: p.y })));
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
      }
    });
  }, [imageLoaded, fabricCanvasRef, clampMoveToImageBounds, clampScaleToImageBounds]);

  const finishPolygonDrawing = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || polygonPoints.length < 3) {
      alert('多角形を描くには最低3つの頂点が必要です。');
      return;
    }

    const objects = canvas.getObjects();
    objects.forEach(obj => { if (obj.isDrawingTemp) canvas.remove(obj); });

    const polygon = new Polygon(polygonPoints, {
      fill: 'transparent', stroke: 'red', strokeWidth: 1, strokeUniform: true,
      borderColor: 'red', cornerColor: 'green', cornerSize: 10, transparentCorners: false,
      hasControls: true, hasBorders: true, isCroppingShape: true, objectCaching: false
    });
    
    polygon.setControlsVisibility({ mtr: false });
    canvas.add(polygon);
    canvas.setActiveObject(polygon);
    setDrawingObject(polygon);
    setIsDrawingPolygon(false);
  }, [polygonPoints, fabricCanvasRef]);

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

  const adjustCroppingShape = useCallback((side, direction) => {
    if (!drawingObject) return;
    const canvas = fabricCanvasRef.current;
    const amount = adjustmentAmount * direction;

    if (drawingObject.type === 'rect') {
      let newLeft = drawingObject.left, newTop = drawingObject.top;
      let newWidth = drawingObject.width, newHeight = drawingObject.height;

      switch (side) {
        case 'top': newTop -= amount; newHeight += amount; break;
        case 'right': newWidth += amount; break;
        case 'bottom': newHeight += amount; break;
        case 'left': newLeft -= amount; newWidth += amount; break;
        default: return;
      }

      if (newWidth < 10) newWidth = 10;
      if (newHeight < 10) newHeight = 10;
      drawingObject.set({ left: newLeft, top: newTop, width: newWidth, height: newHeight });
    } else if (drawingObject.type === 'circle' || drawingObject.type === 'ellipse') {
      let currentRx = drawingObject.rx || drawingObject.radius;
      let currentRy = drawingObject.ry || drawingObject.radius;
      let currentLeft = drawingObject.left, currentTop = drawingObject.top;
      const currentScaleX = drawingObject.scaleX || 1, currentScaleY = drawingObject.scaleY || 1;
      const adjustedAmountX = amount / currentScaleX, adjustedAmountY = amount / currentScaleY;

      switch (side) {
        case 'top': currentRy += adjustedAmountY / 2; currentTop -= drawingObject.type === 'circle' ? adjustedAmountY : amount; break;
        case 'right': currentRx += adjustedAmountX / 2; break;
        case 'bottom': currentRy += adjustedAmountY / 2; break;
        case 'left': currentRx += adjustedAmountX / 2; currentLeft -= drawingObject.type === 'circle' ? adjustedAmountX : amount; break;
        default: return;
      }

      currentRx = Math.max(currentRx, 5 / currentScaleX);
      currentRy = Math.max(currentRy, 5 / currentScaleY);

      if (drawingObject.type === 'circle') {
        canvas.getObjects().forEach(obj => canvas.remove(obj));
        const newEllipse = new Ellipse({
          left: currentLeft, top: currentTop, rx: currentRx, ry: currentRy,
          fill: 'transparent', stroke: 'red', strokeWidth: 1, strokeUniform: true,
          borderColor: 'red', cornerColor: 'green', cornerSize: 10, transparentCorners: false,
          hasControls: true, hasBorders: true, isCroppingShape: true,
          scaleX: currentScaleX, scaleY: currentScaleY,
        });
        newEllipse.setControlsVisibility({ mtr: false });
        canvas.add(newEllipse);
        setDrawingObject(newEllipse);
        canvas.setActiveObject(newEllipse);
      } else {
        drawingObject.set({ left: currentLeft, top: currentTop, rx: currentRx, ry: currentRy });
      }
    }
    drawingObject.setCoords();
    canvas.renderAll();
  }, [drawingObject, adjustmentAmount, fabricCanvasRef]);

  const reset = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.getObjects().forEach(obj => canvas.remove(obj));
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
      canvas.off('path:created');
      canvas.isDrawingMode = false;
    }
    setCroppedImageUrl(null);
    setCroppingMode(null);
    setDrawingObject(null);
    setPolygonPoints([]);
    setIsDrawingPolygon(false);
  }, [fabricCanvasRef, setCroppedImageUrl]);

  return {
    croppingMode, drawingObject, polygonPoints, isDrawingPolygon,
    startCropping, finishPolygonDrawing, editPolygonVertices, adjustCroppingShape, reset
  };
}
