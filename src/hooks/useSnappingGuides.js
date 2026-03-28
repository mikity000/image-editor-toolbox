import { useEffect } from 'react';
import { Line, ActiveSelection, Image as FabricImage } from 'fabric';

export function useSnappingGuides(fabricCanvas, guideThickness, setSelectedSize, saveState) {
  useEffect(() => {
    if (!fabricCanvas) return;

    const snapToPixelPosition = obj => obj.set({ left: Math.round(obj.left), top: Math.round(obj.top) });
    const snapToPixelScale = obj => obj.set({ scaleX: Math.round(obj.getScaledWidth()) / obj.width, scaleY: Math.round(obj.getScaledHeight()) / obj.height });

    const addGuideLine = (coords) => {
      const guideLine = new Line(coords, {
        stroke: 'red',
        strokeWidth: guideThickness,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
      });
      guideLine.isGuide = true;
      fabricCanvas.add(guideLine);
    };

    const updateGuides = (obj = null) => {
      if (!fabricCanvas) return;
      fabricCanvas.getObjects().filter(o => o.isGuide).forEach(o => fabricCanvas.remove(o));

      if (!obj) {
        fabricCanvas.renderAll();
        return;
      }

      const rectA = obj.getBoundingRect();
      const aLeft = rectA.left, aTop = rectA.top, aRight = aLeft + rectA.width, aBottom = aTop + rectA.height;
      const tolerance = 0.5;

      const activeObjs = fabricCanvas.getActiveObjects();
      const others = fabricCanvas.getObjects().filter(o => !activeObjs.includes(o) && !o.isGuide);

      others.forEach(objB => {
        const rectB = objB.getBoundingRect();
        const bLeft = rectB.left, bTop = rectB.top, bRight = bLeft + rectB.width, bBottom = bTop + rectB.height;

        if (Math.abs(aRight - bLeft) <= tolerance) addGuideLine([aRight, Math.min(aTop, bTop), aRight, Math.max(aBottom, bBottom)]);
        else if (Math.abs(bRight - aLeft) <= tolerance) addGuideLine([bRight, Math.min(aTop, bTop), bRight, Math.max(aBottom, bBottom)]);

        if (Math.abs(aBottom - bTop) <= tolerance) addGuideLine([Math.min(aLeft, bLeft), aBottom, Math.max(aRight, bRight), aBottom]);
        else if (Math.abs(bBottom - aTop) <= tolerance) addGuideLine([Math.min(aLeft, bLeft), bBottom, Math.max(aRight, bRight), bBottom]);

        if (Math.abs(aTop - bTop) <= tolerance) addGuideLine([Math.min(aLeft, bLeft), (aTop + bTop) / 2, Math.max(aRight, bRight), (aTop + bTop) / 2]);
        if (Math.abs(aBottom - bBottom) <= tolerance) addGuideLine([Math.min(aLeft, bLeft), (aBottom + bBottom) / 2, Math.max(aRight, bRight), (aBottom + bBottom) / 2]);
        if (Math.abs(aLeft - bLeft) <= tolerance) addGuideLine([(aLeft + bLeft) / 2, Math.min(aTop, bTop), (aLeft + bLeft) / 2, Math.max(aBottom, bBottom)]);
        if (Math.abs(aRight - bRight) <= tolerance) addGuideLine([(aRight + bRight) / 2, Math.min(aTop, bTop), (aRight + bRight) / 2, Math.max(aBottom, bBottom)]);
      });

      fabricCanvas.renderAll();
    };

    const snapDuringMoving = (obj) => {
      const others = fabricCanvas.getObjects().filter(o => o instanceof FabricImage && o !== obj);
      let left = obj.left, top = obj.top;
      const width = obj.getScaledWidth(), height = obj.getScaledHeight();
      const candidateXs = [], candidateYs = [];

      others.forEach(o => {
        const oLeft = o.left, oTop = o.top;
        const oRight = oLeft + o.getScaledWidth(), oBottom = oTop + o.getScaledHeight();
        candidateXs.push(oLeft, oRight, oLeft - width, oRight - width);
        candidateYs.push(oTop, oBottom, oTop - height, oBottom - height);
      });

      const SNAP_TOLERANCE = guideThickness * 5;
      for (const sv of candidateXs) { if (Math.abs(left - sv) <= SNAP_TOLERANCE) left = sv; }
      for (const sv of candidateYs) { if (Math.abs(top - sv) <= SNAP_TOLERANCE) top = sv; }
      obj.set({ left, top });
    };

    const snapDuringScaling = (obj, e) => {
      const transform = e.transform, corner = transform.corner;
      const others = fabricCanvas.getObjects().filter(o => o instanceof FabricImage && o !== obj);
      const SNAP_TOLERANCE = guideThickness * 5;

      obj.setCoords();
      const objBoundingRect = obj.getBoundingRect();
      const offsetX = obj.left - objBoundingRect.left, offsetY = obj.top - objBoundingRect.top;
      const candidateXs = [], candidateYs = [];

      others.forEach(o => {
        o.setCoords();
        const otherBoundingRect = o.getBoundingRect();
        candidateXs.push(otherBoundingRect.left, otherBoundingRect.left + otherBoundingRect.width);
        candidateYs.push(otherBoundingRect.top, otherBoundingRect.top + otherBoundingRect.height);
      });

      const newAttrs = {};
      let newScaleX = null, newScaleY = null;

      if (corner.includes('l')) {
        for (const x of candidateXs) {
          if (Math.abs(objBoundingRect.left - x) <= SNAP_TOLERANCE) {
            const newWidth = objBoundingRect.left + objBoundingRect.width - x;
            if (newWidth > 0) { newScaleX = newWidth / obj.width; newAttrs.left = x + offsetX; }
            break;
          }
        }
      } else if (corner.includes('r')) {
        for (const x of candidateXs) {
          if (Math.abs((objBoundingRect.left + objBoundingRect.width) - x) <= SNAP_TOLERANCE) {
            const newWidth = x - objBoundingRect.left;
            if (newWidth > 0) newScaleX = newWidth / obj.width;
            break;
          }
        }
      }

      if (corner.includes('t')) {
        for (const y of candidateYs) {
          if (Math.abs(objBoundingRect.top - y) <= SNAP_TOLERANCE) {
            const newHeight = objBoundingRect.top + objBoundingRect.height - y;
            if (newHeight > 0) { newScaleY = newHeight / obj.height; newAttrs.top = y + offsetY; }
            break;
          }
        }
      } else if (corner.includes('b')) {
        for (const y of candidateYs) {
          if (Math.abs((objBoundingRect.top + objBoundingRect.height) - y) <= SNAP_TOLERANCE) {
            const newHeight = y - objBoundingRect.top;
            if (newHeight > 0) newScaleY = newHeight / obj.height;
            break;
          }
        }
      }

      const snappedX = newScaleX !== null, snappedY = newScaleY !== null;
      if (corner.length === 2) {
        const scaleRatio = transform.original.scaleX / transform.original.scaleY;
        if (snappedX && !snappedY) newScaleY = newScaleX / scaleRatio;
        else if (snappedY && !snappedX) newScaleX = newScaleY * scaleRatio;
      }

      if (newScaleX !== null) newAttrs.scaleX = newScaleX;
      if (newScaleY !== null) newAttrs.scaleY = newScaleY;

      if (corner.length === 2) {
        if (snappedY && !snappedX && corner.includes('l')) newAttrs.left = objBoundingRect.left + objBoundingRect.width - (obj.width * newScaleX) + offsetX;
        if (snappedX && !snappedY && corner.includes('t')) newAttrs.top = objBoundingRect.top + objBoundingRect.height - (obj.height * newScaleY) + offsetY;
      }

      if (Object.keys(newAttrs).length > 0) {
        obj.set(newAttrs);
        obj.setCoords();
      }
    };

    const handleObjectMoving = (e) => {
      const obj = e.target;
      snapToPixelPosition(obj);
      snapDuringMoving(obj);
      updateGuides(obj);
      const active = fabricCanvas.getActiveObject();
      if (active instanceof ActiveSelection && active === obj) {
        const rect = active.getBoundingRect();
        setSelectedSize({ width: rect.width, height: rect.height });
      } else {
        setSelectedSize({ width: obj.getScaledWidth(), height: obj.getScaledHeight() });
      }
    };

    const handleObjectScaling = (e) => {
      const obj = e.target;
      snapDuringScaling(obj, e);
      snapToPixelPosition(obj);
      snapToPixelScale(obj);
      updateGuides(obj);
      const active = fabricCanvas.getActiveObject();
      if (active instanceof ActiveSelection && active === obj) {
        const rect = active.getBoundingRect();
        setSelectedSize({ width: rect.width, height: rect.height });
      } else {
        setSelectedSize({ width: obj.getScaledWidth(), height: obj.getScaledHeight() });
      }
    };

    const handleObjectModified = () => {
      saveState();
      updateGuides();
      const active = fabricCanvas.getActiveObject();
      if (active) {
          if (active instanceof ActiveSelection) {
              const rect = active.getBoundingRect();
              setSelectedSize({ width: rect.width, height: rect.height });
          } else {
              setSelectedSize({ width: active.getScaledWidth(), height: active.getScaledHeight() });
          }
      }
    };

    const updateSelectedSizeWrapper = () => {
        const active = fabricCanvas.getActiveObject();
        if (!active) { setSelectedSize(null); return; }
        if (active instanceof ActiveSelection) {
            const rect = active.getBoundingRect();
            setSelectedSize({ width: rect.width, height: rect.height });
        } else {
            setSelectedSize({ width: active.getScaledWidth(), height: active.getScaledHeight() });
        }
    }

    fabricCanvas.on('object:moving', handleObjectMoving);
    fabricCanvas.on('object:scaling', handleObjectScaling);
    fabricCanvas.on('object:modified', handleObjectModified);
    fabricCanvas.on('selection:created', updateSelectedSizeWrapper);
    fabricCanvas.on('selection:updated', updateSelectedSizeWrapper);
    fabricCanvas.on('selection:cleared', () => setSelectedSize(null));

    return () => {
      fabricCanvas.off('object:moving', handleObjectMoving);
      fabricCanvas.off('object:scaling', handleObjectScaling);
      fabricCanvas.off('object:modified', handleObjectModified);
      fabricCanvas.off('selection:created', updateSelectedSizeWrapper);
      fabricCanvas.off('selection:updated', updateSelectedSizeWrapper);
      fabricCanvas.off('selection:cleared');
    };
  }, [fabricCanvas, guideThickness, setSelectedSize, saveState]);
}
