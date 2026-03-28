import { useCallback } from 'react';
import { Canvas, FabricImage, Rect, Circle, Ellipse, Polygon, Point, Path, util } from 'fabric';

export function useImageCrop(fabricCanvasRef, drawingObject, croppingMode, setCroppedImageUrl) {
  const crop = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    const image = canvas.backgroundImage;
    if (!image || !image._element) return;

    const originalImageWidth = image._element.naturalWidth;
    const originalImageHeight = image._element.naturalHeight;
    const scaleFactorX = originalImageWidth / image.getScaledWidth();
    const scaleFactorY = originalImageHeight / image.getScaledHeight();

    const bounds = drawingObject.getBoundingRect();
    const imageDisplayLeft = image.left;
    const imageDisplayTop = image.top;

    const cropLeftInOriginalPixels = Math.round((bounds.left - imageDisplayLeft) * scaleFactorX);
    const cropTopInOriginalPixels = Math.round((bounds.top - imageDisplayTop) * scaleFactorY);
    const cropWidthInOriginalPixels = Math.round(bounds.width * scaleFactorX);
    const cropHeightInOriginalPixels = Math.round(bounds.height * scaleFactorY);

    const tempCanvas = new Canvas(null, {
      width: originalImageWidth,
      height: originalImageHeight,
    });

    const fullResImage = new FabricImage(image._element, {
      left: 0, top: 0, selectable: false, evented: false,
    });

    let clipPathObject;

    if (croppingMode === 'rect') {
      clipPathObject = new Rect({
        left: cropLeftInOriginalPixels, top: cropTopInOriginalPixels,
        width: cropWidthInOriginalPixels, height: cropHeightInOriginalPixels,
        absolutePositioned: true,
      });
    } else if (croppingMode === 'circle') {
      const rxInOriginalPixels = Math.round(cropWidthInOriginalPixels / 2);
      const ryInOriginalPixels = Math.round(cropHeightInOriginalPixels / 2);
      const centerXInOriginalPixels = Math.round(((bounds.left + bounds.width / 2) - imageDisplayLeft) * scaleFactorX);
      const centerYInOriginalPixels = Math.round(((bounds.top + bounds.height / 2) - imageDisplayTop) * scaleFactorY);

      if (Math.abs(drawingObject.scaleX - drawingObject.scaleY) > 0.001 || drawingObject.type === 'ellipse') {
        clipPathObject = new Ellipse({
          left: centerXInOriginalPixels - rxInOriginalPixels, top: centerYInOriginalPixels - ryInOriginalPixels,
          rx: rxInOriginalPixels, ry: ryInOriginalPixels, absolutePositioned: true,
        });
      } else {
        clipPathObject = new Circle({
          left: centerXInOriginalPixels - rxInOriginalPixels, top: centerYInOriginalPixels - ryInOriginalPixels,
          radius: rxInOriginalPixels, absolutePositioned: true,
        });
      }
    } else if (croppingMode === 'polygon') {
      const matrix = drawingObject.calcTransformMatrix();
      const pointsInOriginalSpace = drawingObject.points.map(p => {
        const pathOffsetX = drawingObject.pathOffset ? drawingObject.pathOffset.x : 0;
        const pathOffsetY = drawingObject.pathOffset ? drawingObject.pathOffset.y : 0;
        const localPoint = new Point(p.x - pathOffsetX, p.y - pathOffsetY);
        const absolutePoint = util.transformPoint(localPoint, matrix);
        
        const origX = (absolutePoint.x - imageDisplayLeft) * scaleFactorX;
        const origY = (absolutePoint.y - imageDisplayTop) * scaleFactorY;
        return { x: origX, y: origY };
      });
      clipPathObject = new Polygon(pointsInOriginalSpace, { absolutePositioned: true });
    } else if (croppingMode === 'path') {
      clipPathObject = new Path(drawingObject.path, {
        left: (drawingObject.left - imageDisplayLeft) * scaleFactorX,
        top: (drawingObject.top - imageDisplayTop) * scaleFactorY,
        scaleX: drawingObject.scaleX * scaleFactorX,
        scaleY: drawingObject.scaleY * scaleFactorY,
        pathOffset: drawingObject.pathOffset,
        absolutePositioned: true,
      });
    }

    fullResImage.clipPath = clipPathObject;
    tempCanvas.add(fullResImage);
    tempCanvas.renderAll();

    const maskBounds = clipPathObject.getBoundingRect(true, true);
    const finalCroppedImage = tempCanvas.toDataURL({
      format: 'png',
      multiplier: 1,
      left: Math.round(maskBounds.left),
      top: Math.round(maskBounds.top),
      width: Math.round(maskBounds.width),
      height: Math.round(maskBounds.height),
    });

    setCroppedImageUrl(finalCroppedImage);

    canvas.add(drawingObject);
    image.clipPath = undefined;
    canvas.renderAll();
    tempCanvas.dispose();
  }, [drawingObject, croppingMode, fabricCanvasRef, setCroppedImageUrl]);

  return { crop };
}
