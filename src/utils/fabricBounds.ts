import { Canvas, FabricObject } from 'fabric';
import { Point } from '../types/common';

/**
 * オブジェクトの移動位置をキャンバス背景画像の領域内に制限します。
 * @param obj 移動対象オブジェクト
 * @param canvas Fabric Canvas
 */
export const clampMoveToImageBounds = (obj: FabricObject | null | undefined, canvas: Canvas | null | undefined): void => {
  if (!canvas?.backgroundImage || !obj) return;
  const bg = canvas.backgroundImage;
  const bgLeft = bg.left || 0;
  const bgTop = bg.top || 0;
  const bgRight = bgLeft + bg.getScaledWidth();
  const bgBottom = bgTop + bg.getScaledHeight();
  const objWidth = obj.getScaledWidth();
  const objHeight = obj.getScaledHeight();
  
  const buffer = 1;
  const clampedLeft = Math.min(Math.max(obj.left ?? 0, bgLeft - buffer), bgRight - objWidth + buffer);
  const clampedTop = Math.min(Math.max(obj.top ?? 0, bgTop - buffer), bgBottom - objHeight + buffer);
  
  obj.set({ left: clampedLeft, top: clampedTop });
  obj.setCoords();
};

/**
 * オブジェクトの拡大・縮小をキャンバス背景画像の領域内に制限します。
 * @param obj スケール対象オブジェクト
 * @param canvas Fabric Canvas
 */
export const clampScaleToImageBounds = (obj: FabricObject | null | undefined, canvas: Canvas | null | undefined): void => {
  if (!canvas?.backgroundImage || !obj) return;
  const bg = canvas.backgroundImage;
  const buffer = 1;
  const bgLeft = (bg.left || 0) - buffer;
  const bgTop = (bg.top || 0) - buffer;
  const bgWidth = bg.getScaledWidth() + buffer * 2;
  const bgHeight = bg.getScaledHeight() + buffer * 2;
  const bgRight = bgLeft + bgWidth;
  const bgBottom = bgTop + bgHeight;

  if (!obj._orig) {
    obj._orig = {
      left: obj.left ?? 0,
      top: obj.top ?? 0,
      scaleX: obj.scaleX ?? 1,
      scaleY: obj.scaleY ?? 1,
      width: obj.width || 1,
      height: obj.height || 1,
      originX: obj.originX,
      originY: obj.originY,
      corner: (obj as any).__corner || (canvas as any)._currentTransform?.corner || ''
    };
  }
  const orig = obj._orig;
  const corner = orig.corner || '';

  let maxScaleX = bgWidth / (orig.width || 1);
  let maxScaleY = bgHeight / (orig.height || 1);

  if (corner.includes('b')) maxScaleY = Math.min(maxScaleY, (bgBottom - orig.top) / (orig.height || 1));
  if (corner.includes('t')) maxScaleY = Math.min(maxScaleY, (orig.top + orig.height * orig.scaleY - bgTop) / (orig.height || 1));
  if (corner.includes('r')) maxScaleX = Math.min(maxScaleX, (bgRight - orig.left) / (orig.width || 1));
  if (corner.includes('l')) maxScaleX = Math.min(maxScaleX, (orig.left + orig.width * orig.scaleX - bgLeft) / (orig.width || 1));

  const EPS = 1e-8;
  let clampedScaleX = Math.min(obj.scaleX ?? 1, maxScaleX);
  let clampedScaleY = Math.min(obj.scaleY ?? 1, maxScaleY);
  if (Math.abs(clampedScaleX - maxScaleX) < EPS) clampedScaleX = maxScaleX;
  if (Math.abs(clampedScaleY - maxScaleY) < EPS) clampedScaleY = maxScaleY;
  
  obj.set({ scaleX: clampedScaleX, scaleY: clampedScaleY });
  const newWidth = obj.getScaledWidth();
  const newHeight = obj.getScaledHeight();
  const ox = orig.originX === 'center' ? 0.5 : (orig.originX === 'right' ? 1 : 0);
  const oy = orig.originY === 'center' ? 0.5 : (orig.originY === 'bottom' ? 1 : 0);
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
};

/**
 * 任意の座標点をキャンバス背景画像の領域内にクランプします。
 * @param point 座標
 * @param canvas Fabric Canvas
 * @returns クランプされた座標
 */
export const clampPointToImageBounds = (point: Point | null | undefined, canvas: Canvas | null | undefined): Point => {
  if (!point) return { x: 0, y: 0 };
  if (!canvas?.backgroundImage) return point;
  const bg = canvas.backgroundImage;
  const bgLeft = bg.left || 0;
  const bgTop = bg.top || 0;
  const bgRight = bgLeft + bg.getScaledWidth();
  const bgBottom = bgTop + bg.getScaledHeight();
  
  return {
    x: Math.min(Math.max(point.x, bgLeft), bgRight),
    y: Math.min(Math.max(point.y, bgTop), bgBottom)
  };
};
