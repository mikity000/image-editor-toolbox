import { useCallback, useRef } from 'react';
import { Canvas, PencilBrush, FabricObject } from 'fabric';
import { CROP_CONFIG } from '../constants/Constants';

export interface UseFreehandCropperReturn {
  enableFreehand: () => void;
  disableFreehand: () => void;
}

export function useFreehandCropper(
  fabricCanvasRef: React.RefObject<Canvas | null> | { current: Canvas | null },
  setDrawingObject?: ((obj: FabricObject | null) => void) | null,
  triggerAutoCrop?: (() => void) | null,
  pathSmoothing: number = 20
): UseFreehandCropperReturn {
  const pathCreatedHandlerRef = useRef<((opt: any) => void) | null>(null);

  const disableFreehand = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.isDrawingMode = false;
      if (pathCreatedHandlerRef.current) {
        canvas.off('path:created', pathCreatedHandlerRef.current);
        pathCreatedHandlerRef.current = null;
      }
    }
  }, [fabricCanvasRef]);

  const enableFreehand = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    disableFreehand();

    canvas.isDrawingMode = true;
    if (!canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new PencilBrush(canvas);
    }
    canvas.freeDrawingBrush.color = 'red';
    canvas.freeDrawingBrush.width = 2;
    canvas.freeDrawingBrush.decimate = pathSmoothing;

    const handlePathCreated = (opt: any) => {
      const pathObj: FabricObject = opt.path;
      if (!pathObj) return;

      canvas.isDrawingMode = false;

      const bounds = pathObj.getBoundingRect();
      if (
        bounds.width < CROP_CONFIG.MIN_SHAPE_SIZE ||
        bounds.height < CROP_CONFIG.MIN_SHAPE_SIZE
      ) {
        canvas.remove(pathObj);
        return;
      }

      pathObj.set({
        fill: 'transparent',
        stroke: 'red',
        strokeWidth: 1,
        strokeUniform: true,
        borderColor: 'red',
        cornerColor: 'green',
        cornerSize: 10,
        transparentCorners: false,
        isCroppingShape: true,
      });
      pathObj.setControlsVisibility({ mtr: false });
      setDrawingObject?.(pathObj);
      canvas.setActiveObject(pathObj);
      triggerAutoCrop?.();
    };

    pathCreatedHandlerRef.current = handlePathCreated;
    canvas.on('path:created', handlePathCreated);
  }, [fabricCanvasRef, pathSmoothing, setDrawingObject, triggerAutoCrop, disableFreehand]);

  return { enableFreehand, disableFreehand };
}
