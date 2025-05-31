import { useEffect, useRef, useState } from 'react';
import { Point } from 'fabric';
import { COMBINE_CONFIG } from '../constants/Constants';

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

    const { ZOOM_MIN, ZOOM_MAX } = COMBINE_CONFIG;


    if (!isMobile) {
      const handleWheel = (opt) => {
        const evt = opt.e;
        let zoom = fabricCanvas.getZoom();
        zoom *= 0.999 ** evt.deltaY;
        zoom = Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX);
        const center = fabricCanvas.getCenter();
        fabricCanvas.zoomToPoint(new Point(center.left, center.top), zoom);
        setZoomLevel(zoom);
        evt.preventDefault();
        evt.stopPropagation();
      };


      const handleMouseDown = (opt) => {
        const evt = opt.e;
        if (evt?.altKey) {
          isPanning.current = true;
          lastPos.current = { x: evt.clientX, y: evt.clientY };
          fabricCanvas.defaultCursor = 'grab';
          fabricCanvas.discardActiveObject();
        }
      };

      const handleMouseMove = (opt) => {
        if (isPanning.current && opt.e) {
          const evt = opt.e;
          const deltaX = evt.clientX - lastPos.current.x;
          const deltaY = evt.clientY - lastPos.current.y;
          fabricCanvas.relativePan(new Point(deltaX, deltaY));
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
      const getTouchDist = (e) => {
        const [t0, t1] = e.touches;
        return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      };

      const getMidPoint = (e) => {
        const [t0, t1] = e.touches;
        return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      };

      const touchStart = (e) => {
        if (e.touches?.length === 2) {
          e.preventDefault();
          fabricCanvas.discardActiveObject();
          touchData.current.isTwoFing = true;
          touchData.current.lastDist = getTouchDist(e);
          touchData.current.lastMid = getMidPoint(e);
        }
      };

      const touchMove = (e) => {
        if (touchData.current.isTwoFing && e.touches?.length === 2) {
          e.preventDefault();
          const newDist = getTouchDist(e);
          const distDiff = Math.abs(newDist - touchData.current.lastDist);

          if (distDiff > 30) {
            const scale = newDist / (touchData.current.lastDist || 1);
            const dampenedScale = 1 + (scale - 1) * 0.1;
            let newZoom = fabricCanvas.getZoom() * scale * dampenedScale;
            newZoom = Math.min(Math.max(newZoom, ZOOM_MIN), ZOOM_MAX);

            const center = fabricCanvas.getCenter();
            fabricCanvas.zoomToPoint(new Point(center.left, center.top), newZoom);
            setZoomLevel(newZoom);

            touchData.current.lastDist = newDist;
            touchData.current.lastMid = getMidPoint(e);
          } else {
            const mid = getMidPoint(e);
            const deltaX = mid.x - touchData.current.lastMid.x;
            const deltaY = mid.y - touchData.current.lastMid.y;

            fabricCanvas.relativePan(new Point(deltaX, deltaY));
            touchData.current.lastMid = mid;
          }
        }
      };

      const touchEnd = (e) => {
        if (touchData.current.isTwoFing && (!e.touches || e.touches.length < 2)) {
          touchData.current.isTwoFing = false;
        }
      };

      const wrapper = fabricCanvas.wrapperEl;
      if (wrapper) {
        wrapper.style.touchAction = 'none';
        wrapper.addEventListener('touchstart', touchStart, { passive: false });
        wrapper.addEventListener('touchmove', touchMove, { passive: false });
        wrapper.addEventListener('touchend', touchEnd);
        wrapper.addEventListener('touchcancel', touchEnd);
        
        return () => {
          wrapper.removeEventListener('touchstart', touchStart);
          wrapper.removeEventListener('touchmove', touchMove);
          wrapper.removeEventListener('touchend', touchEnd);
          wrapper.removeEventListener('touchcancel', touchEnd);
        };
      }
    }
  }, [fabricCanvas, isMobile]);

  return { zoomLevel, setZoomLevel };
}

