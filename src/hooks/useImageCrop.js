import { useCallback } from 'react';
import { Canvas, FabricImage, Rect, Circle, Ellipse, Polygon, Point, Path, util } from 'fabric';

export function useImageCrop(fabricCanvasRef, drawingObject, croppingMode, setCroppedImageUrl, invertCrop = false, setExportBoundsCanvas) {
  const crop = useCallback(async (overrideObj = null) => {
    const canvas = fabricCanvasRef.current;
    const image = canvas.backgroundImage;
    if (!image || !image._element) return;

    const shapes = canvas.getObjects().filter(o => o.isCroppingShape);
    if (shapes.length === 0 && !overrideObj) {
      setCroppedImageUrl(null);
      return;
    }

    const targetShapes = overrideObj ? [...shapes, overrideObj] : shapes;

    const originalImageWidth = image._element.naturalWidth;
    const originalImageHeight = image._element.naturalHeight;
    const scaleFactorX = originalImageWidth / image.getScaledWidth();
    const scaleFactorY = originalImageHeight / image.getScaledHeight();

    const imageDisplayLeft = image.left;
    const imageDisplayTop = image.top;

    const tempCanvas = new Canvas(null, {
      width: originalImageWidth,
      height: originalImageHeight,
    });

    const fullResImage = new FabricImage(image._element, {
      left: 0, top: 0, selectable: false, evented: false,
    });

    const clipShapes = targetShapes.map(targetObj => {
      const bounds = targetObj.getBoundingRect();
      const cropLeftInOriginalPixels = Math.round((bounds.left - imageDisplayLeft) * scaleFactorX);
      const cropTopInOriginalPixels = Math.round((bounds.top - imageDisplayTop) * scaleFactorY);
      const cropWidthInOriginalPixels = Math.round(bounds.width * scaleFactorX);
      const cropHeightInOriginalPixels = Math.round(bounds.height * scaleFactorY);

      let clipPathObject;

      if (targetObj.type === 'rect') {
        clipPathObject = new Rect({
          left: cropLeftInOriginalPixels, top: cropTopInOriginalPixels,
          width: cropWidthInOriginalPixels, height: cropHeightInOriginalPixels,
          absolutePositioned: true, fill: 'black'
        });
      } else if (targetObj.type === 'circle' || targetObj.type === 'ellipse') {
        const rxInOriginalPixels = Math.round(cropWidthInOriginalPixels / 2);
        const ryInOriginalPixels = Math.round(cropHeightInOriginalPixels / 2);
        const centerXInOriginalPixels = Math.round(((bounds.left + bounds.width / 2) - imageDisplayLeft) * scaleFactorX);
        const centerYInOriginalPixels = Math.round(((bounds.top + bounds.height / 2) - imageDisplayTop) * scaleFactorY);

        if (targetObj.type === 'ellipse' || Math.abs(targetObj.scaleX - targetObj.scaleY) > 0.001) {
          clipPathObject = new Ellipse({
            left: centerXInOriginalPixels - rxInOriginalPixels, top: centerYInOriginalPixels - ryInOriginalPixels,
            rx: rxInOriginalPixels, ry: ryInOriginalPixels, absolutePositioned: true, fill: 'black'
          });
        } else {
          clipPathObject = new Circle({
            left: centerXInOriginalPixels - rxInOriginalPixels, top: centerYInOriginalPixels - ryInOriginalPixels,
            radius: rxInOriginalPixels, absolutePositioned: true, fill: 'black'
          });
        }
      } else if (targetObj.type === 'polygon') {
        const matrix = targetObj.calcTransformMatrix();
        const pointsInOriginalSpace = targetObj.points.map(p => {
          const pathOffsetX = targetObj.pathOffset ? targetObj.pathOffset.x : 0;
          const pathOffsetY = targetObj.pathOffset ? targetObj.pathOffset.y : 0;
          const localPoint = new Point(p.x - pathOffsetX, p.y - pathOffsetY);
          const absolutePoint = util.transformPoint(localPoint, matrix);
          
          const origX = (absolutePoint.x - imageDisplayLeft) * scaleFactorX;
          const origY = (absolutePoint.y - imageDisplayTop) * scaleFactorY;
          return { x: origX, y: origY };
        });
        clipPathObject = new Polygon(pointsInOriginalSpace, { absolutePositioned: true, fill: 'black' });
      } else if (targetObj.type === 'path') {
        clipPathObject = new Path(targetObj.path, {
          left: (targetObj.left - imageDisplayLeft) * scaleFactorX,
          top: (targetObj.top - imageDisplayTop) * scaleFactorY,
          scaleX: targetObj.scaleX * scaleFactorX,
          scaleY: targetObj.scaleY * scaleFactorY,
          pathOffset: targetObj.pathOffset,
          absolutePositioned: true, fill: 'black'
        });
      }
      return clipPathObject;
    }).filter(Boolean);

    if (invertCrop) {
      tempCanvas.add(fullResImage);
      clipShapes.forEach(shape => {
        shape.globalCompositeOperation = 'destination-out';
        tempCanvas.add(shape);
      });
    } else {
      clipShapes.forEach(shape => {
        tempCanvas.add(shape);
      });
      fullResImage.globalCompositeOperation = 'source-in';
      tempCanvas.add(fullResImage);
    }
    
    tempCanvas.renderAll();

    let exportLeft, exportTop, exportWidth, exportHeight;
    if (invertCrop) {
      exportLeft = 0;
      exportTop = 0;
      exportWidth = originalImageWidth;
      exportHeight = originalImageHeight;
    } else {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      clipShapes.forEach(s => {
        s.setCoords();
        const b = s.getBoundingRect();
        minX = Math.min(minX, b.left);
        minY = Math.min(minY, b.top);
        maxX = Math.max(maxX, b.left + b.width);
        maxY = Math.max(maxY, b.top + b.height);
      });
      exportLeft = Math.round(minX);
      exportTop = Math.round(minY);
      exportWidth = Math.round(maxX - minX);
      exportHeight = Math.round(maxY - minY);
      
      exportLeft = Math.max(0, exportLeft);
      exportTop = Math.max(0, exportTop);
      if (exportLeft + exportWidth > originalImageWidth) exportWidth = originalImageWidth - exportLeft;
      if (exportTop + exportHeight > originalImageHeight) exportHeight = originalImageHeight - exportTop;
    }

    const finalCroppedImage = tempCanvas.toDataURL({
      format: 'png',
      multiplier: 1,
      left: exportLeft,
      top: exportTop,
      width: exportWidth,
      height: exportHeight,
    });

    setCroppedImageUrl(finalCroppedImage);
    if (setExportBoundsCanvas) {
      setExportBoundsCanvas({
        left: imageDisplayLeft + exportLeft / scaleFactorX,
        top: imageDisplayTop + exportTop / scaleFactorY,
        width: exportWidth / scaleFactorX,
        height: exportHeight / scaleFactorY
      });
    }
    tempCanvas.dispose();
  }, [croppingMode, fabricCanvasRef, setCroppedImageUrl, invertCrop, setExportBoundsCanvas]);

  return { crop };
}
