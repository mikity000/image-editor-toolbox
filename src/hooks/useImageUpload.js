import { useState } from 'react';
import { Image as FabricImage } from 'fabric';

export function useImageUpload(fabricCanvasRef, setCroppedImageUrl) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const uploadImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataURL = event.target.result;
      const canvas = fabricCanvasRef.current;
      canvas.clear();
      if (setCroppedImageUrl) setCroppedImageUrl(null);

      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';
      imgEl.src = dataURL;
      imgEl.onload = () => {
        const canvasW = canvas.getWidth();
        const canvasH = canvas.getHeight();
        const scaleX = canvasW / imgEl.width;
        const scaleY = canvasH / imgEl.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = imgEl.width * scale;
        const scaledHeight = imgEl.height * scale;
        const left = (canvasW - scaledWidth) / 2;
        const top = (canvasH - scaledHeight) / 2;

        const fabricImg = new FabricImage(imgEl, {
          left: left, top: top, scaleX: scale, scaleY: scale,
          selectable: false, evented: false,
        });

        fabricImg.origSrc = dataURL;
        canvas.backgroundImage = fabricImg;
        canvas.renderAll();
        setImageLoaded(true);
      };
    };
    reader.readAsDataURL(file);
  };

  return { imageLoaded, uploadImage };
}
