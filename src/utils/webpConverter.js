import { fileToDataUrl } from './imageUtils';
import { IMAGE_CONFIG } from '../constants/Constants';

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
      if (!ctx) {
        reject(new Error('2Dコンテキストの取得に失敗しました。'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(new Error('画像の読み込みに失敗しました。'));
    img.src = dataUrl;
  });
}

// CanvasからImageDataを取得する
function canvasToImageData(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2Dコンテキストの取得に失敗しました。');
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Canvas または DataURL を高品質な WebP (DataURL) に非同期で変換します。
 * Web Worker を使用してメインスレッドのブロッキングを防ぎます。
 * 
 * @param {HTMLCanvasElement|string} canvasOrDataUrl 変換対象のCanvasまたはDataURL
 * @param {object} options オプション
 * @param {number} [options.quality] 品質（0〜100）
 * @param {number} [options.timeout] タイムアウトミリ秒
 * @param {function} [options.onProgress] 進捗コールバック (0〜100の数値)
 * @returns {Promise<string>} WebP の DataURL
 */
export async function convertToWebP(canvasOrDataUrl, options = {}) {
  const { 
    quality = IMAGE_CONFIG.DEFAULT_WEBP_QUALITY, 
    timeout = IMAGE_CONFIG.WEBP_WORKER_TIMEOUT_MS, 
    onProgress 
  } = options;



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
    const messageId = Math.random().toString(36).slice(2, 11);
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };

    const handleMessage = async (e) => {
      const { id, type, error, data } = e.data || {};
      if (id !== messageId) return;

      cleanup();

      if (type === 'SUCCESS') {
        if (onProgress) onProgress(90);
        try {
          const blob = new Blob([data], { type: 'image/webp' });
          const resultDataUrl = await fileToDataUrl(blob);
          if (onProgress) onProgress(100);
          resolve(resultDataUrl);
        } catch (err) {
          if (onProgress) onProgress(0);
          reject(err);
        }
      } else {
        if (onProgress) onProgress(0);
        reject(new Error(error || 'WebPへの変換に失敗しました。'));
      }
    };

    const handleError = (err) => {
      cleanup();
      if (onProgress) onProgress(0);
      reject(new Error(err.message || 'Worker処理中にエラーが発生しました。'));
    };

    // タイムアウト設定
    if (timeout > 0) {
      timer = setTimeout(() => {
        cleanup();
        if (onProgress) onProgress(0);
        reject(new Error('WebP変換がタイムアウトしました。'));
      }, timeout);
    }

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

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

