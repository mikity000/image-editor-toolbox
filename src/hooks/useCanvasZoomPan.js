import { useEffect, useRef, useState } from 'react';
import { Point } from 'fabric';

export function useCanvasZoomPan(fabricCanvas, isMobile) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  
  const touchData = useRef({
    isTwoFing: false,
    lastDist: 0,
    lastMid: { x: 0, y: 0 },
  });

  useEffect(() => {
    if (!fabricCanvas) return;

    if (!isMobile) {
      const handleWheel = (opt) => {
        const evt = opt.e;
        let zoom = fabricCanvas.getZoom();
        zoom *= 0.999 ** evt.deltaY;
        zoom = Math.min(Math.max(zoom, 0.1), 10);
        const pointer = fabricCanvas.getPointer(evt);
        fabricCanvas.zoomToPoint({ x: pointer.x, y: pointer.y }, zoom);
        setZoomLevel(zoom);
        evt.preventDefault();
        evt.stopPropagation();
      };

      const handleMouseDown = (opt) => {
        const evt = opt.e;
        if (evt.altKey) {
          isPanning.current = true;
          lastPos.current = { x: evt.clientX, y: evt.clientY };
          fabricCanvas.defaultCursor = 'grab';
        }
      };

      const handleMouseMove = (opt) => {
        if (isPanning.current) {
          const evt = opt.e;
          const deltaX = evt.clientX - lastPos.current.x;
          const deltaY = evt.clientY - lastPos.current.y;
          fabricCanvas.relativePan({ x: deltaX, y: deltaY });
          lastPos.current = { x: evt.clientX, y: evt.clientY };
        }
      };

      const handleMouseUp = () => {
        if (isPanning.current) {
          isPanning.current = false;
          fabricCanvas.defaultCursor = 'default';
        }
      };

      fabricCanvas.on('mouse:wheel', handleWheel);
      fabricCanvas.on('mouse:down', handleMouseDown);
      fabricCanvas.on('mouse:move', handleMouseMove);
      fabricCanvas.on('mouse:up', handleMouseUp);

      return () => {
        fabricCanvas.off('mouse:wheel', handleWheel);
        fabricCanvas.off('mouse:down', handleMouseDown);
        fabricCanvas.off('mouse:move', handleMouseMove);
        fabricCanvas.off('mouse:up', handleMouseUp);
      };
    } else {
      const getTouchDist = e => {
        const [t0, t1] = e.touches;
        return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      };
      const getMidPoint = e => {
        const [t0, t1] = e.touches;
        return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      };

      const touchStart = e => {
        if (e.touches.length === 2) {
          e.preventDefault();
          fabricCanvas.discardActiveObject();
          touchData.current.isTwoFing = true;
          touchData.current.lastDist = getTouchDist(e);
          const mid = getMidPoint(e);
          touchData.current.lastMid = { x: mid.x, y: mid.y };
        }
      };

      const touchMove = e => {
        if (touchData.current.isTwoFing && e.touches.length === 2) {
          e.preventDefault();
          const newDist = getTouchDist(e);
          const distDiff = Math.abs(newDist - touchData.current.lastDist);

          if (distDiff > 30) {
            const scale = newDist / touchData.current.lastDist;
            const dampenedScale = 1 + (scale - 1) * 0.1;
            let newZoom = fabricCanvas.getZoom() * scale * dampenedScale;
            newZoom = Math.min(Math.max(newZoom, 0.01), 10);

            const mid = getMidPoint(e);
            const pointer = fabricCanvas.getPointer({ clientX: mid.x, clientY: mid.y });
            fabricCanvas.zoomToPoint(new Point(pointer.x, pointer.y), newZoom);
            setZoomLevel(newZoom);

            touchData.current.lastDist = newDist;
            const updatedMid = getMidPoint(e);
            touchData.current.lastMid = { x: updatedMid.x, y: updatedMid.y };
          } else {
            const mid = getMidPoint(e);
            const lastMid = touchData.current.lastMid;
            const deltaX = mid.x - lastMid.x;
            const deltaY = mid.y - lastMid.y;

            fabricCanvas.relativePan({ x: deltaX, y: deltaY });
            touchData.current.lastMid = { x: mid.x, y: mid.y };
          }
        }
      };

      const touchEnd = e => {
        if (touchData.current.isTwoFing && e.touches.length < 2) {
          touchData.current.isTwoFing = false;
        }
      };

      const wrapper = fabricCanvas.wrapperEl;
      if (wrapper) {
        wrapper.style.touchAction = 'none';
        wrapper.addEventListener('touchstart', touchStart, { passive: false });
        wrapper.addEventListener('touchmove', touchMove, { passive: false });
        wrapper.addEventListener('touchend', touchEnd);
        
        return () => {
          wrapper.removeEventListener('touchstart', touchStart);
          wrapper.removeEventListener('touchmove', touchMove);
          wrapper.removeEventListener('touchend', touchEnd);
        };
      }
    }
  }, [fabricCanvas, isMobile, setZoomLevel]);

  return { zoomLevel, setZoomLevel };
}
