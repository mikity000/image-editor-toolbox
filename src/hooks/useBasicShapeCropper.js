import { useCallback } from 'react';
import { Rect, Circle } from 'fabric';

export function useBasicShapeCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, adjustmentAmount = 1) {
  const startDrawing = useCallback((mode, startPoint) => {
    const currentShape = mode === 'rect' ? new Rect({ width: 0, height: 0 }) : new Circle({ radius: 0 });
    currentShape.set({
      left: startPoint.x, top: startPoint.y, fill: 'transparent', stroke: 'red', strokeWidth: 1,
      strokeUniform: true, borderColor: 'red', cornerColor: 'green', cornerSize: 10,
      transparentCorners: false, hasControls: true, hasBorders: true, isCroppingShape: true
    });
    currentShape.setControlsVisibility({ mtr: false });
    return currentShape;
  }, []);

  const updateDrawing = useCallback((mode, currentShape, startPoint, pointer) => {
    if (!currentShape) return;
    if (mode === 'rect') {
      currentShape.set({
        width: Math.abs(pointer.x - startPoint.x), height: Math.abs(pointer.y - startPoint.y),
        left: Math.min(pointer.x, startPoint.x), top: Math.min(pointer.y, startPoint.y),
      });
    } else if (mode === 'circle') {
      const radius = Math.max(Math.abs(pointer.x - startPoint.x), Math.abs(pointer.y - startPoint.y)) / 2;
      currentShape.set({ radius: radius, left: startPoint.x - radius, top: startPoint.y - radius });
    }
  }, []);

  const finishDrawing = useCallback((currentShape, canvas) => {
    if (currentShape) {
      currentShape.setCoords();

      const bounds = currentShape.getBoundingRect();
      if (Math.max(bounds.width, bounds.height) < 10) {
        canvas.remove(currentShape);
        return;
      }

      canvas.setActiveObject(currentShape);
      setDrawingObject(currentShape);
      triggerAutoCrop();
    }
  }, [setDrawingObject, triggerAutoCrop]);

  const adjustCroppingShape = useCallback((drawingObject, side, direction) => {
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

    const baseW = drawingObject.width || (drawingObject.rx ? drawingObject.rx * 2 : drawingObject.radius * 2);
    const baseH = drawingObject.height || (drawingObject.ry ? drawingObject.ry * 2 : drawingObject.radius * 2);

    if (!baseW || !baseH) return;

    const deltaScaleX = amount / baseW;
    const deltaScaleY = amount / baseH;

    switch (side) {
      case 'top': top -= amount; scaleY += deltaScaleY; break;
      case 'bottom': scaleY += deltaScaleY; break;
      case 'left': left -= amount; scaleX += deltaScaleX; break;
      case 'right': scaleX += deltaScaleX; break;
      default: return;
    }

    if (baseW * scaleX < 10) scaleX = 10 / baseW;
    if (baseH * scaleY < 10) scaleY = 10 / baseH;

    drawingObject.set({ left, top, scaleX, scaleY });
    
    const activeObj = canvas.getActiveObject() || drawingObject;
    if (activeObj) activeObj.setCoords();

    const image = canvas.backgroundImage;
    if (image) {
      const bounds = drawingObject.getBoundingRect();
      const imgLeft = image.left;
      const imgTop = image.top;
      const imgRight = imgLeft + image.getScaledWidth();
      const imgBottom = imgTop + image.getScaledHeight();
      const epsilon = 1.5; 

      let outOfBounds = false;
      switch (side) {
        case 'left': if (bounds.left < imgLeft - epsilon) outOfBounds = true; break;
        case 'right': if (bounds.left + bounds.width > imgRight + epsilon) outOfBounds = true; break;
        case 'top': if (bounds.top < imgTop - epsilon) outOfBounds = true; break;
        case 'bottom': if (bounds.top + bounds.height > imgBottom + epsilon) outOfBounds = true; break;
        default: break;
      }

      if (outOfBounds) {
        drawingObject.set({ left: oldLeft, top: oldTop, scaleX: oldScaleX, scaleY: oldScaleY });
        if (activeObj) activeObj.setCoords();
      }
    }

    canvas.renderAll();
    triggerAutoCrop();
  }, [fabricCanvasRef, adjustmentAmount, triggerAutoCrop]);

  return { startDrawing, updateDrawing, finishDrawing, adjustCroppingShape };
}
