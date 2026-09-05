import { useCallback, useRef, useEffect } from 'react';
import {
  Canvas,
  FabricImage,
  Rect,
  Circle,
  Ellipse,
  Polygon,
  Point,
  Path,
  FabricObject,
} from 'fabric';
import { convertToWebP } from '../utils/webpConverter';
import { BoundingBox } from '../types/common';

export interface UseImageCropReturn {
  crop: (overrideObj?: FabricObject | null) => Promise<void>;
}

export function useImageCrop(
  fabricCanvasRef: React.RefObject<Canvas | null> | { current: Canvas | null },
  setCroppedImageUrl?: ((url: string | null) => void) | null,
  invertCrop: boolean = false,
  setExportBoundsCanvas?: ((bounds: BoundingBox) => void) | null
): UseImageCropReturn {
  const tempCanvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    return () => {
      if (tempCanvasRef.current) {
        tempCanvasRef.current.dispose();
        tempCanvasRef.current = null;
      }
    };
  }, []);

  const crop = useCallback(
    async (overrideObj: FabricObject | null = null) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const image = canvas.backgroundImage as FabricImage | undefined;
      if (!image || !(image as any)._element) return;

      const shapes = canvas.getObjects().filter((o) => o.isCroppingShape);
      if (shapes.length === 0 && !overrideObj) {
        setCroppedImageUrl?.(null);
        return;
      }

      const targetShapes = overrideObj ? [...shapes, overrideObj] : shapes;

      const imgEl = (image as any).getElement?.() || (image as any)._element;
      const originalImageWidth = imgEl.naturalWidth || imgEl.width || 0;
      const originalImageHeight = imgEl.naturalHeight || imgEl.height || 0;
      if (originalImageWidth === 0 || originalImageHeight === 0) return;

      const scaleFactorX = originalImageWidth / (image.getScaledWidth() || 1);
      const scaleFactorY = originalImageHeight / (image.getScaledHeight() || 1);

      const imageDisplayLeft = image.left || 0;
      const imageDisplayTop = image.top || 0;

      if (!tempCanvasRef.current) {
        const tempCanvasElement = document.createElement('canvas');
        tempCanvasRef.current = new Canvas(tempCanvasElement);
      }
      const tempCanvas = tempCanvasRef.current;

      if (
        tempCanvas.width !== originalImageWidth ||
        tempCanvas.height !== originalImageHeight
      ) {
        tempCanvas.setWidth(originalImageWidth);
        tempCanvas.setHeight(originalImageHeight);
      }
      tempCanvas.clear();

      const fullResImage = new FabricImage(imgEl, {
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });

      const clipShapes = targetShapes
        .map((targetObj) => {
          const bounds = targetObj.getBoundingRect();
          const cropLeftInOriginalPixels = Math.round(
            (bounds.left - imageDisplayLeft) * scaleFactorX
          );
          const cropTopInOriginalPixels = Math.round(
            (bounds.top - imageDisplayTop) * scaleFactorY
          );
          const cropWidthInOriginalPixels = Math.round(bounds.width * scaleFactorX);
          const cropHeightInOriginalPixels = Math.round(bounds.height * scaleFactorY);

          let clipPathObject: FabricObject | null = null;

          if (targetObj.type === 'rect') {
            clipPathObject = new Rect({
              left: cropLeftInOriginalPixels,
              top: cropTopInOriginalPixels,
              width: cropWidthInOriginalPixels,
              height: cropHeightInOriginalPixels,
              absolutePositioned: true,
              fill: 'black',
            });
          } else if (targetObj.type === 'circle' || targetObj.type === 'ellipse') {
            const rxInOriginalPixels = Math.round(cropWidthInOriginalPixels / 2);
            const ryInOriginalPixels = Math.round(cropHeightInOriginalPixels / 2);
            const centerXInOriginalPixels = Math.round(
              (bounds.left + bounds.width / 2 - imageDisplayLeft) * scaleFactorX
            );
            const centerYInOriginalPixels = Math.round(
              (bounds.top + bounds.height / 2 - imageDisplayTop) * scaleFactorY
            );

            if (
              targetObj.type === 'ellipse' ||
              Math.abs((targetObj.scaleX || 1) - (targetObj.scaleY || 1)) > 0.001
            ) {
              clipPathObject = new Ellipse({
                left: centerXInOriginalPixels - rxInOriginalPixels,
                top: centerYInOriginalPixels - ryInOriginalPixels,
                rx: rxInOriginalPixels,
                ry: ryInOriginalPixels,
                absolutePositioned: true,
                fill: 'black',
              });
            } else {
              clipPathObject = new Circle({
                left: centerXInOriginalPixels - rxInOriginalPixels,
                top: centerYInOriginalPixels - ryInOriginalPixels,
                radius: rxInOriginalPixels,
                absolutePositioned: true,
                fill: 'black',
              });
            }
          } else if (targetObj.type === 'polygon') {
            const matrix = targetObj.calcTransformMatrix
              ? targetObj.calcTransformMatrix()
              : [1, 0, 0, 1, 0, 0];
            const pointsInOriginalSpace = (targetObj.points || []).map((p) => {
              const pathOffsetX = targetObj.pathOffset ? targetObj.pathOffset.x : 0;
              const pathOffsetY = targetObj.pathOffset ? targetObj.pathOffset.y : 0;
              const localPoint = new Point(p.x - pathOffsetX, p.y - pathOffsetY);
              const absolutePoint = localPoint.transform(matrix as any);

              const origX = (absolutePoint.x - imageDisplayLeft) * scaleFactorX;
              const origY = (absolutePoint.y - imageDisplayTop) * scaleFactorY;
              return { x: origX, y: origY };
            });
            clipPathObject = new Polygon(pointsInOriginalSpace, {
              absolutePositioned: true,
              fill: 'black',
            });
          } else if (targetObj.type === 'path') {
            clipPathObject = new Path(targetObj.path, {
              left: (targetObj.left - imageDisplayLeft) * scaleFactorX,
              top: (targetObj.top - imageDisplayTop) * scaleFactorY,
              scaleX: (targetObj.scaleX || 1) * scaleFactorX,
              scaleY: (targetObj.scaleY || 1) * scaleFactorY,
              pathOffset: targetObj.pathOffset,
              absolutePositioned: true,
              fill: 'black',
            });
          }
          return clipPathObject;
        })
        .filter((obj): obj is FabricObject => obj !== null);

      if (invertCrop) {
        tempCanvas.add(fullResImage);
        clipShapes.forEach((shape) => {
          shape.set({ stroke: 'black', strokeWidth: 2 });
          shape.globalCompositeOperation = 'destination-out';
          tempCanvas.add(shape);
        });
      } else {
        clipShapes.forEach((shape) => {
          tempCanvas.add(shape);
        });
        fullResImage.globalCompositeOperation = 'source-in';
        tempCanvas.add(fullResImage);
      }

      tempCanvas.renderAll();

      let exportLeft: number, exportTop: number, exportWidth: number, exportHeight: number;
      if (invertCrop) {
        const renderedCanvas = tempCanvas.toCanvasElement();
        const ctx = renderedCanvas.getContext('2d');
        if (!ctx) return;
        const imageData = ctx.getImageData(0, 0, originalImageWidth, originalImageHeight);
        const data = imageData.data;
        const ALPHA_THRESHOLD = 0;

        let minX = originalImageWidth,
          minY = originalImageHeight,
          maxX = 0,
          maxY = 0;
        let hasContent = false;

        for (let y = 0; y < originalImageHeight; y++) {
          for (let x = 0; x < originalImageWidth; x++) {
            const alpha = data[(y * originalImageWidth + x) * 4 + 3];
            if (alpha > ALPHA_THRESHOLD) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              hasContent = true;
            }
          }
        }

        if (hasContent) {
          exportLeft = minX;
          exportTop = minY;
          exportWidth = maxX - minX + 1;
          exportHeight = maxY - minY + 1;
        } else {
          exportLeft = 0;
          exportTop = 0;
          exportWidth = originalImageWidth;
          exportHeight = originalImageHeight;
        }
      } else {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        clipShapes.forEach((s) => {
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

        const origLeft = exportLeft;
        exportLeft = Math.max(0, exportLeft);
        exportWidth -= exportLeft - origLeft;

        const origTop = exportTop;
        exportTop = Math.max(0, exportTop);
        exportHeight -= exportTop - origTop;

        if (exportLeft + exportWidth > originalImageWidth)
          exportWidth = originalImageWidth - exportLeft;
        if (exportTop + exportHeight > originalImageHeight)
          exportHeight = originalImageHeight - exportTop;
      }

      if (exportWidth <= 0 || exportHeight <= 0) return;

      try {
        const finalCroppedImagePng = tempCanvas.toDataURL({
          format: 'png',
          multiplier: 1,
          left: exportLeft,
          top: exportTop,
          width: exportWidth,
          height: exportHeight,
        });

        const finalCroppedImage = await convertToWebP(finalCroppedImagePng);
        setCroppedImageUrl?.(finalCroppedImage);
        if (setExportBoundsCanvas) {
          setExportBoundsCanvas({
            left: imageDisplayLeft + exportLeft / scaleFactorX,
            top: imageDisplayTop + exportTop / scaleFactorY,
            width: exportWidth / scaleFactorX,
            height: exportHeight / scaleFactorY,
          });
        }
      } catch (err) {
        console.error('クロップ画像変換エラー:', err);
      }
    },
    [fabricCanvasRef, setCroppedImageUrl, invertCrop, setExportBoundsCanvas]
  );

  return { crop };
}
