import Upscaler from 'upscaler';
import x2Model from '@upscalerjs/esrgan-slim/2x';
import x4Model from '@upscalerjs/esrgan-slim/4x';
import { convertToWebP } from './webpConverter';
import { PDF_CONFIG } from '../constants/Constants';

type UpscalerInstance = InstanceType<typeof Upscaler>;

// モデルごとの Upscaler インスタンスをキャッシュ
const upscalerInstances: {
  2?: UpscalerInstance;
  4?: UpscalerInstance;
} = {};

/**
 * 指定されたスケール (2x または 4x) の Upscaler インスタンスを取得します。
 * GitHub Pages上のローカル静的ファイル (/models/esrgan-slim/...) からの読み込みを優先し、
 * 完全オフライン・サーバー不要で動作するように設計されています。
 */
export async function getUpscalerInstance(scale: 2 | 4 = 2): Promise<UpscalerInstance> {
  if (!upscalerInstances[scale]) {
    const baseModel = scale === 4 ? x4Model : x2Model;
    const publicUrl = process.env.PUBLIC_URL || '';
    const localModelPath = `${publicUrl}/models/esrgan-slim/x${scale}/model.json`;

    try {
      // 1. まずローカル静的モデル（GitHub Pages内）からのロードを試行
      upscalerInstances[scale] = new Upscaler({
        model: {
          ...baseModel,
          path: localModelPath,
        },
      });
    } catch (e) {
      console.warn('ローカルモデルのロードに失敗したため、CDNモデルにフォールバックします:', e);
      // 2. 失敗時はデフォルト定義（CDN経由）にフォールバック
      upscalerInstances[scale] = new Upscaler({
        model: baseModel,
      });
    }
  }
  return upscalerInstances[scale]!;
}

export interface UpscaleOptions {
  scale?: 2 | 4;
  patchSize?: number;
  padding?: number;
  outputFormat?: 'png' | 'webp' | 'jpeg';
  onProgress?: (percent: number) => void;
}

/**
 * 入力画像（DataURL、Blob、または HTMLImageElement）をAI超解像処理して高解像度化します。
 * @param input 画像データ
 * @param options オプション（倍率、パッチサイズ、進捗コールバックなど）
 * @returns 超解像処理後の画像 DataURL (デフォルトはPDF埋め込みにも安全なPNG)
 */
export async function upscaleImage(
  input: string | Blob | HTMLImageElement,
  options: UpscaleOptions = {}
): Promise<string> {
  const {
    scale = 2,
    patchSize = 64,
    padding = 4,
    outputFormat = 'png',
    onProgress,
  } = options;

  let imageElement: HTMLImageElement;

  if (input instanceof HTMLImageElement) {
    imageElement = input;
  } else {
    imageElement = new Image();
    imageElement.crossOrigin = 'anonymous';

    let srcUrl: string;
    let shouldRevoke = false;

    if (typeof input === 'string') {
      srcUrl = input;
    } else {
      srcUrl = URL.createObjectURL(input);
      shouldRevoke = true;
    }

    await new Promise<void>((resolve, reject) => {
      imageElement.onload = () => resolve();
      imageElement.onerror = (err) => reject(err);
      imageElement.src = srcUrl;
    });

    if (shouldRevoke) {
      URL.revokeObjectURL(srcUrl);
    }
  }

  onProgress?.(5);

  const upscaler = await getUpscalerInstance(scale);

  // パッチ分割による超解像推論（結果はPNG DataURL）
  const resultBase64 = await upscaler.upscale(imageElement, {
    patchSize,
    padding,
    progress: (rate: number) => {
      // 5% 〜 95% の範囲で進捗を報告
      const percent = Math.min(95, Math.round(5 + rate * 90));
      onProgress?.(percent);
    },
  });

  onProgress?.(95);

  let finalDataUrl = resultBase64;
  if (outputFormat === 'webp') {
    try {
      finalDataUrl = await convertToWebP(resultBase64, { quality: 92 });
    } catch (err) {
      console.warn('WebP変換に失敗したため、PNG形式を維持します:', err);
    }
  } else if (outputFormat === 'jpeg') {
    try {
      finalDataUrl = await new Promise<string>((resolve, reject) => {
        const tempImg = new Image();
        tempImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = tempImg.width;
          canvas.height = tempImg.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(resultBase64);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tempImg, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        tempImg.onerror = reject;
        tempImg.src = resultBase64;
      });
    } catch (err) {
      console.warn('JPEG変換に失敗したため、PNG形式を維持します:', err);
    }
  }

  onProgress?.(100);
  return finalDataUrl;
}

/**
 * 画像の解像度（幅と高さ）を測定します。
 */
export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/**
 * 画像リスト全体の最大基準サイズ（長辺最大値）を算出します。
 */
export function calculateMaxReferenceSize(
  images: Array<{ width?: number; height?: number }>
): number {
  let maxSize = 0;
  for (const img of images) {
    const size = Math.max(img.width || 0, img.height || 0);
    if (size > maxSize) {
      maxSize = size;
    }
  }
  return maxSize;
}

/**
 * 画像リスト内の最大画像サイズを基準とし、指定画像がPDF化時に低解像度になるかどうかを判定します。
 * @param currentWidth 対象画像の幅
 * @param currentHeight 対象画像の高さ
 * @param maxReferenceSize リスト内の全画像における最大基準サイズ（長辺最大値）
 * @returns { isLowRes: boolean; recommendedScale: 2 | 4 | null }
 */
export function evaluateRelativeResolution(
  currentWidth?: number,
  currentHeight?: number,
  maxReferenceSize?: number
): { isLowRes: boolean; recommendedScale: 2 | 4 | null } {
  if (!maxReferenceSize || maxReferenceSize <= 0 || !currentWidth || !currentHeight) {
    return { isLowRes: false, recommendedScale: null };
  }

  // 対象画像の基準サイズ（長辺）
  const currentSize = Math.max(currentWidth, currentHeight);
  const ratio = currentSize / maxReferenceSize;

  if (ratio < PDF_CONFIG.RELATIVE_VERY_LOW_RES_RATIO) {
    // 最大サイズの35%未満：極低解像度（4倍モデル推奨）
    return { isLowRes: true, recommendedScale: 4 };
  } else if (ratio < PDF_CONFIG.RELATIVE_LOW_RES_RATIO) {
    // 最大サイズの60%未満：低解像度（2倍モデル推奨）
    return { isLowRes: true, recommendedScale: 2 };
  }

  // 60%以上：十分な解像度があるため対象外
  return { isLowRes: false, recommendedScale: null };
}
