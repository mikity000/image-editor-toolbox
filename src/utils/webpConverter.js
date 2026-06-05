// Web Worker のインスタンスをシングルトンとして管理
let webpWorker = null;

function getWorker() {
  if (!webpWorker) {
    webpWorker = new Worker(new URL('./webp.worker.js', import.meta.url));
  }
  return webpWorker;
}

// DataURLをロードしてImageDataを取得する
function dataUrlToImageData(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

// CanvasからImageDataを取得する
function canvasToImageData(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Canvas または DataURL を高品質な WebP (DataURL) に非同期で変換します。
 * Web Worker を使用してメインスレッドのブロッキングを防ぎます。
 * 
 * @param {HTMLCanvasElement|string} canvasOrDataUrl 変換対象のCanvasまたはDataURL
 * @param {object} options オプション
 * @param {number} options.quality 品質（0〜100、デフォルト: 85）
 * @param {function} options.onProgress 進捗コールバック (0〜100の数値を引数に取る)
 * @returns {Promise<string>} WebP の DataURL
 */
export async function convertToWebP(canvasOrDataUrl, options = {}) {
  const { quality = 85, onProgress } = options;

  if (onProgress) onProgress(10);

  let imageData;
  try {
    if (typeof canvasOrDataUrl === 'string') {
      imageData = await dataUrlToImageData(canvasOrDataUrl);
    } else if (canvasOrDataUrl instanceof HTMLCanvasElement) {
      imageData = canvasToImageData(canvasOrDataUrl);
    } else {
      throw new Error('無効な入力です。CanvasまたはDataURLを指定してください。');
    }
  } catch (err) {
    if (onProgress) onProgress(0);
    throw err;
  }

  if (onProgress) onProgress(30);

  const worker = getWorker();

  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36).substring(2, 11);

    const handleMessage = (e) => {
      const { id, type, error, data } = e.data;
      if (id !== messageId) return;

      worker.removeEventListener('message', handleMessage);

      if (type === 'SUCCESS') {
        if (onProgress) onProgress(90);
        const blob = new Blob([data], { type: 'image/webp' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (onProgress) onProgress(100);
          resolve(reader.result);
        };
        reader.onerror = (err) => {
          if (onProgress) onProgress(0);
          reject(err);
        };
        reader.readAsDataURL(blob);
      } else {
        if (onProgress) onProgress(0);
        reject(new Error(error || 'WebPへの変換に失敗しました。'));
      }
    };

    worker.addEventListener('message', handleMessage);

    if (onProgress) onProgress(50);

    // ImageDataのピクセルデータをTransferableオブジェクトとして転送
    worker.postMessage({
      id: messageId,
      width: imageData.width,
      height: imageData.height,
      data: imageData.data.buffer,
      quality
    }, [imageData.data.buffer]);
  });
}
