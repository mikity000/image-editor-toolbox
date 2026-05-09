let edgeCanvasContext = null;
let edgeCanvasWidth = 0;
let edgeCanvasHeight = 0;

export const initEdgeDetectionCanvas = (fabricCanvas) => {
  if (!fabricCanvas || !fabricCanvas.backgroundImage) return;
  const bgImage = fabricCanvas.backgroundImage;
  
  const canvas = document.createElement('canvas');
  canvas.width = fabricCanvas.getWidth();
  canvas.height = fabricCanvas.getHeight();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  const imgEl = bgImage.getElement();
  if (!imgEl) return;

  // bgImage のスケールやオフセットを加味して描画する
  ctx.drawImage(
    imgEl, 
    0, 0, imgEl.width, imgEl.height,
    bgImage.left || 0, bgImage.top || 0, 
    imgEl.width * (bgImage.scaleX || 1), 
    imgEl.height * (bgImage.scaleY || 1)
  );
  
  edgeCanvasContext = ctx;
  edgeCanvasWidth = canvas.width;
  edgeCanvasHeight = canvas.height;
};

export const clearEdgeDetectionCanvas = () => {
  edgeCanvasContext = null;
  edgeCanvasWidth = 0;
  edgeCanvasHeight = 0;
};

export const findClosestEdge = (x, y, radius = 30, threshold = 80) => {
  if (!edgeCanvasContext) return { x, y, snapped: false };

  // マウス座標を中心とした走査範囲を計算
  const startX = Math.max(0, Math.floor(x - radius));
  const startY = Math.max(0, Math.floor(y - radius));
  const endX = Math.min(edgeCanvasWidth, Math.ceil(x + radius));
  const endY = Math.min(edgeCanvasHeight, Math.ceil(y + radius));
  const width = endX - startX;
  const height = endY - startY;

  if (width <= 0 || height <= 0) return { x, y, snapped: false };

  // Sobelフィルタ計算のため、周囲1ピクセルの余白を含めて取得する
  const extractStartX = Math.max(0, startX - 1);
  const extractStartY = Math.max(0, startY - 1);
  const extractEndX = Math.min(edgeCanvasWidth, endX + 1);
  const extractEndY = Math.min(edgeCanvasHeight, endY + 1);
  const extractWidth = extractEndX - extractStartX;
  const extractHeight = extractEndY - extractStartY;

  if (extractWidth < 3 || extractHeight < 3) return { x, y, snapped: false };

  const imageData = edgeCanvasContext.getImageData(extractStartX, extractStartY, extractWidth, extractHeight);
  const data = imageData.data;

  // Sobelカーネル
  const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  let bestScore = -Infinity;
  let bestX = x;
  let bestY = y;
  let found = false;

  const getGrayscale = (px, py) => {
    const idx = (py * extractWidth + px) * 4;
    return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  };

  // 取得した画像データの範囲内でループ
  for (let py = 1; py < extractHeight - 1; py++) {
    for (let px = 1; px < extractWidth - 1; px++) {
      let pixelX = 0;
      let pixelY = 0;

      // 3x3 のカーネルを適用
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = getGrayscale(px + kx, py + ky);
          const weightIdx = (ky + 1) * 3 + (kx + 1);
          pixelX += val * kernelX[weightIdx];
          pixelY += val * kernelY[weightIdx];
        }
      }

      // エッジの強度
      const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
      
      if (magnitude > threshold) {
        const absX = extractStartX + px;
        const absY = extractStartY + py;
        const dist = Math.sqrt(Math.pow(absX - x, 2) + Math.pow(absY - y, 2));

        // エッジの強度が強く、かつマウス座標に近い座標をスコアで評価する
        // 距離のペナルティを掛けることで、より近いエッジを優先しやすくする
        const score = magnitude - (dist * 3.5);

        if (score > bestScore && dist <= radius) {
          bestScore = score;
          bestX = absX;
          bestY = absY;
          found = true;
        }
      }
    }
  }

  if (found) {
    return { x: bestX, y: bestY, snapped: true };
  }

  return { x, y, snapped: false };
};
