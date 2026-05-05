import { useCallback } from 'react';
import { PencilBrush } from 'fabric';

export function useFreehandCropper(fabricCanvasRef, setDrawingObject, triggerAutoCrop, pathSmoothing) {
  const enableFreehand = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = true;
    if (!canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new PencilBrush(canvas);
    }
    canvas.freeDrawingBrush.color = 'red';
    canvas.freeDrawingBrush.width = 2;
    canvas.freeDrawingBrush.decimate = pathSmoothing;

    canvas.on('path:created', (opt) => {
      const pathObj = opt.path;
      canvas.isDrawingMode = false;

      const bounds = pathObj.getBoundingRect();
      if (Math.max(bounds.width, bounds.height) < 10) {
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
        isCroppingShape: true
      });
      pathObj.setControlsVisibility({ mtr: false });
      setDrawingObject(pathObj);
      canvas.setActiveObject(pathObj);
      triggerAutoCrop();
    });
  }, [fabricCanvasRef, pathSmoothing, setDrawingObject, triggerAutoCrop]);

  const disableFreehand = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.isDrawingMode = false;
      canvas.off('path:created');
    }
  }, [fabricCanvasRef]);

  return { enableFreehand, disableFreehand };
}
