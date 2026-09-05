import { useCallback } from 'react';
import { Canvas, Rect, Circle, FabricObject } from 'fabric';
import { CROP_CONFIG } from '../constants/Constants';
import { Point } from '../types/common';
import { CroppingMode } from '../types/crop';

export interface UseBasicShapeCropperReturn {
  startDrawing: (mode: CroppingMode, startPoint: Point) => FabricObject;
  updateDrawing: (
    mode: CroppingMode,
    currentShape: FabricObject | null,
    startPoint: Point,
    pointer: Point
  ) => void;
  finishDrawing: (currentShape: FabricObject | null, canvas: Canvas | null) => void;
  adjustCroppingShape: (
    drawingObject: FabricObject | null,
    side: 'top' | 'bottom' | 'left' | 'right',
    direction: number
  ) => void;
}

export function useBasicShapeCropper(
  fabricCanvasRef: React.RefObject<Canvas | null> | { current: Canvas | null },
  setDrawingObject?: ((obj: FabricObject | null) => void) | null,
  triggerAutoCrop?: (() => void) | null,
  adjustmentAmount: number = 1
): UseBasicShapeCropperReturn {
  const startDrawing = useCallback((mode: CroppingMode, startPoint: Point): FabricObject => {
    const currentShape =
      mode === 'rect' ? new Rect({ width: 0, height: 0 }) : new Circle({ radius: 0 });
    currentShape.set({
      left: startPoint.x,
      top: startPoint.y,
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
    });
    currentShape.setControlsVisibility({ mtr: false });
    return currentShape;
  }, []);

  const updateDrawing = useCallback(
    (
      mode: CroppingMode,
      currentShape: FabricObject | null,
      startPoint: Point,
      pointer: Point
    ) => {
      if (!currentShape) return;
      if (mode === 'rect') {
        currentShape.set({
          width: Math.abs(pointer.x - startPoint.x),
          height: Math.abs(pointer.y - startPoint.y),
          left: Math.min(pointer.x, startPoint.x),
          top: Math.min(pointer.y, startPoint.y),
        });
      } else if (mode === 'circle') {
        const radius =
          Math.max(Math.abs(pointer.x - startPoint.x), Math.abs(pointer.y - startPoint.y)) / 2;
        currentShape.set({
          radius,
          left: startPoint.x - radius,
          top: startPoint.y - radius,
        });
      }
    },
    []
  );

  const finishDrawing = useCallback(
    (currentShape: FabricObject | null, canvas: Canvas | null) => {
      if (currentShape && canvas) {
        currentShape.setCoords();

        const bounds = currentShape.getBoundingRect();
        if (
          bounds.width < CROP_CONFIG.MIN_SHAPE_SIZE ||
          bounds.height < CROP_CONFIG.MIN_SHAPE_SIZE
        ) {
          canvas.remove(currentShape);
          return;
        }

        canvas.setActiveObject(currentShape);
        setDrawingObject?.(currentShape);
        triggerAutoCrop?.();
      }
    },
    [setDrawingObject, triggerAutoCrop]
  );

  const adjustCroppingShape = useCallback(
    (
      drawingObject: FabricObject | null,
      side: 'top' | 'bottom' | 'left' | 'right',
      direction: number
    ) => {
      if (!drawingObject) return;
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const amount = adjustmentAmount * direction;

      let scaleX = drawingObject.scaleX || 1;
      let scaleY = drawingObject.scaleY || 1;
      let left = drawingObject.left;
      let top = drawingObject.top;

      const oldScaleX = scaleX;
      const oldScaleY = scaleY;
      const oldLeft = left;
      const oldTop = top;

      const baseW =
        drawingObject.width ||
        ((drawingObject as any).rx
          ? (drawingObject as any).rx * 2
          : ((drawingObject as any).radius || 0) * 2);
      const baseH =
        drawingObject.height ||
        ((drawingObject as any).ry
          ? (drawingObject as any).ry * 2
          : ((drawingObject as any).radius || 0) * 2);

      if (!baseW || !baseH) return;

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
        default:
          return;
      }

      const minSize = CROP_CONFIG.MIN_SHAPE_SIZE;
      if (baseW * scaleX < minSize) scaleX = minSize / baseW;
      if (baseH * scaleY < minSize) scaleY = minSize / baseH;

      drawingObject.set({ left, top, scaleX, scaleY });

      const activeObj = canvas.getActiveObject() || drawingObject;
      if (activeObj) activeObj.setCoords();

      const image = canvas.backgroundImage;
      if (image) {
        const bounds = drawingObject.getBoundingRect();
        const imgLeft = image.left || 0;
        const imgTop = image.top || 0;
        const imgRight = imgLeft + image.getScaledWidth();
        const imgBottom = imgTop + image.getScaledHeight();
        const epsilon = 1.5;

        let outOfBounds = false;
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
          default:
            break;
        }

        if (outOfBounds) {
          drawingObject.set({
            left: oldLeft,
            top: oldTop,
            scaleX: oldScaleX,
            scaleY: oldScaleY,
          });
          if (activeObj) activeObj.setCoords();
        }
      }

      canvas.renderAll();
      triggerAutoCrop?.();
    },
    [fabricCanvasRef, adjustmentAmount, triggerAutoCrop]
  );

  return { startDrawing, updateDrawing, finishDrawing, adjustCroppingShape };
}
