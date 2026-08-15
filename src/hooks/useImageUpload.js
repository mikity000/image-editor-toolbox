import { useState, useCallback } from 'react';
import { FabricImage } from 'fabric';
import { fileToDataUrl } from '../utils/imageUtils';

export function useImageUpload(fabricCanvasRef, setCroppedImageUrl) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageName, setImageName] = useState('');

  const loadImageFromUrl = useCallback((dataURL) => {
    const canvas = fabricCanvasRef?.current;
    if (!canvas) return;
    canvas.clear();
    if (setCroppedImageUrl) setCroppedImageUrl(null);

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = dataURL;
    imgEl.onload = () => {
      const canvasW = canvas.getWidth();
      const canvasH = canvas.getHeight();
      const origW = imgEl.naturalWidth || imgEl.width || canvasW;
      const origH = imgEl.naturalHeight || imgEl.height || canvasH;

      const scaleX = canvasW / (origW || 1);
      const scaleY = canvasH / (origH || 1);
      const scale = Math.min(scaleX, scaleY);

      const scaledWidth = origW * scale;
      const scaledHeight = origH * scale;
      const left = (canvasW - scaledWidth) / 2;
      const top = (canvasH - scaledHeight) / 2;

      const fabricImg = new FabricImage(imgEl, {
        left,
        top,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      });

      fabricImg.origSrc = dataURL;
      canvas.backgroundImage = fabricImg;
      canvas.renderAll();
      setImageLoaded(true);
    };

    imgEl.onerror = (err) => {
      console.error('画像のロードに失敗しました:', err);
    };
  }, [fabricCanvasRef, setCroppedImageUrl]);

  const uploadImage = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setImageName(file.name);
    try {
      const dataUrl = await fileToDataUrl(file);
      loadImageFromUrl(dataUrl);
    } catch (err) {
      console.error('ファイルの読み込みに失敗しました:', err);
    }
  }, [loadImageFromUrl]);

  return { imageLoaded, uploadImage, loadImageFromUrl, setImageLoaded, imageName, setImageName };
}

