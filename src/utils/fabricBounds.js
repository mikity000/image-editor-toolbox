export const clampMoveToImageBounds = (obj, canvas) => {
  if (!canvas || !canvas.backgroundImage) return;
  const bg = canvas.backgroundImage;
  const bgLeft = bg.left, bgTop = bg.top;
  const bgRight = bgLeft + bg.getScaledWidth(), bgBottom = bgTop + bg.getScaledHeight();
  const objWidth = obj.getScaledWidth(), objHeight = obj.getScaledHeight();
  
  const clampedLeft = Math.min(Math.max(obj.left, bgLeft), bgRight - objWidth);
  const clampedTop = Math.min(Math.max(obj.top, bgTop), bgBottom - objHeight);
  
  obj.set({ left: clampedLeft, top: clampedTop });
  obj.setCoords();
};

export const clampScaleToImageBounds = (obj, canvas) => {
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
};

export const clampPointToImageBounds = (point, canvas) => {
  if (!canvas || !canvas.backgroundImage) return point;
  const bg = canvas.backgroundImage;
  const bgLeft = bg.left, bgTop = bg.top;
  const bgRight = bgLeft + bg.getScaledWidth(), bgBottom = bgTop + bg.getScaledHeight();
  
  return {
    x: Math.min(Math.max(point.x, bgLeft), bgRight),
    y: Math.min(Math.max(point.y, bgTop), bgBottom)
  };
};
