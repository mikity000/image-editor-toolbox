import imageCompression from 'browser-image-compression';
import { IMAGE_CONFIG } from '../constants/Constants';

/**
 * ユニークIDを生成します。
 * @param prefix プレフィックス
 * @returns ユニークID
 */
export const generateUniqueId = (prefix: string = 'item'): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * 画像のURLやDataURLから HTMLImageElement を非同期でロードします。
 * @param src 画像のURLまたはDataURL
 * @returns ロード済み HTMLImageElement
 */
export const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
    img.src = src;
  });
};

/**
 * ギャラリー内での重複を避けた連番付き名称を生成します。
 * @param baseName 元のファイル名
 * @param galleryImages ギャラリー画像一覧
 * @returns 連番付きファイル名
 */
export const getSequentialName = (
  baseName: string,
  galleryImages: Array<{ name?: string }> = []
): string => {
  const base = baseName.replace(/\.[^/.]+$/, '');
  const regex = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d+)$`);

  const maxNum = galleryImages.reduce((max, img) => {
    if (!img?.name) return max;
    const match = img.name.match(regex);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);

  return `${base}_${maxNum + 1}`;
};

/**
 * File または Blob オブジェクトを受け取り、DataURL に非同期で変換します。
 * @param fileOrBlob 変換対象のオブジェクト
 * @returns DataURL の Promise
 */
export const fileToDataUrl = (fileOrBlob: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
};

/**
 * 面積平均（Area/Box リサンプリング）用の重み情報
 */
interface ResampleWeight {
  index: number;
  weight: number;
}

/**
 * 1次元の面積平均（Area resampling）用重みテーブルを事前計算します。
 * 各出力ピクセルがカバーする入力ピクセルの重複幅を計算して正規化します。
 * 
 * @param srcSize 元画像のサイズ（px）
 * @param dstSize 出力画像のサイズ（px）
 * @returns 各出力ピクセルに対応する入力ピクセルと重みの配列
 */
function precomputeAreaWeights(srcSize: number, dstSize: number): ResampleWeight[][] {
  const ratio = srcSize / dstSize;
  const weights: ResampleWeight[][] = new Array(dstSize);

  for (let dst = 0; dst < dstSize; dst++) {
    const start = dst * ratio;
    const end = Math.min(srcSize, (dst + 1) * ratio);
    const startFloor = Math.floor(start);
    const endCeil = Math.min(srcSize, Math.ceil(end));

    const rowWeights: ResampleWeight[] = [];
    let totalWeight = 0;

    for (let src = startFloor; src < endCeil; src++) {
      const w = Math.min(src + 1, end) - Math.max(src, start);
      if (w > 0) {
        rowWeights.push({ index: src, weight: w });
        totalWeight += w;
      }
    }

    if (totalWeight > 0) {
      for (let i = 0; i < rowWeights.length; i++) {
        rowWeights[i].weight /= totalWeight;
      }
    }

    weights[dst] = rowWeights;
  }

  return weights;
}

/**
 * 厳密な Area（面積平均 / INTER_AREA）アルゴリズムを用いて画像を縮小した HTMLCanvasElement を生成します。
 * 出力ピクセルがカバーする入力画像の領域面積で各入力ピクセルを加重平均（面積積分）するため、
 * 周期パターン（網点、ハーフトーン、ストライプ等）によるモアレ（エイリアシング）を数学的に完全に防止します。
 * 
 * 2パス分離可能フィルタ（Separable 2-Pass Filter）と重み事前計算により、高解像度画像でも極めて高速に動作します。
 * 
 * @param source 元画像（HTMLImageElement または HTMLCanvasElement）
 * @param targetWidth 目標幅 (px)
 * @param targetHeight 目標高さ (px)
 * @returns リサイズされた HTMLCanvasElement
 */
export const resizeWithAreaAverage = (
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement => {
  const origW = (source as HTMLImageElement).naturalWidth || source.width;
  const origH = (source as HTMLImageElement).naturalHeight || source.height;

  const tW = Math.max(1, Math.round(targetWidth));
  const tH = Math.max(1, Math.round(targetHeight));

  // 元サイズと目標サイズが同一の場合はそのまま描画して返す
  if (origW === tW && origH === tH) {
    const canvas = document.createElement('canvas');
    canvas.width = tW;
    canvas.height = tH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0);
    }
    return canvas;
  }

  // 拡大処理の場合（面積平均は縮小専用補間のため、拡大は高品質バイキュービック/バイリニア補間を使用）
  if (tW >= origW && tH >= origH) {
    const canvas = document.createElement('canvas');
    canvas.width = tW;
    canvas.height = tH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, tW, tH);
    }
    return canvas;
  }

  // 元画像の ImageData を取得
  let srcImageData: ImageData;
  if (source instanceof HTMLCanvasElement) {
    const ctx = source.getContext('2d');
    if (ctx) {
      srcImageData = ctx.getImageData(0, 0, origW, origH);
    } else {
      const helperCanvas = document.createElement('canvas');
      helperCanvas.width = origW;
      helperCanvas.height = origH;
      const helperCtx = helperCanvas.getContext('2d');
      if (!helperCtx) return helperCanvas;
      helperCtx.drawImage(source, 0, 0);
      srcImageData = helperCtx.getImageData(0, 0, origW, origH);
    }
  } else {
    const helperCanvas = document.createElement('canvas');
    helperCanvas.width = origW;
    helperCanvas.height = origH;
    const helperCtx = helperCanvas.getContext('2d');
    if (!helperCtx) return helperCanvas;
    helperCtx.drawImage(source, 0, 0);
    srcImageData = helperCtx.getImageData(0, 0, origW, origH);
  }

  const srcData = srcImageData.data;

  // Pass 1: 水平方向（X軸）の面積平均縮小 (origW -> tW, origH 維持)
  const weightsX = precomputeAreaWeights(origW, tW);
  const interBuf = new Float32Array(tW * origH * 4);

  for (let y = 0; y < origH; y++) {
    const srcRowOffset = y * origW * 4;
    const dstRowOffset = y * tW * 4;

    for (let x = 0; x < tW; x++) {
      const wList = weightsX[x];
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let i = 0; i < wList.length; i++) {
        const item = wList[i];
        const srcIdx = srcRowOffset + item.index * 4;
        const w = item.weight;
        const a = srcData[srcIdx + 3];
        const alphaFactor = a / 255;

        // Premultiplied Alpha で混色・黒ずみアーティファクトを防止
        rSum += srcData[srcIdx] * alphaFactor * w;
        gSum += srcData[srcIdx + 1] * alphaFactor * w;
        bSum += srcData[srcIdx + 2] * alphaFactor * w;
        aSum += a * w;
      }

      const dstIdx = dstRowOffset + x * 4;
      interBuf[dstIdx] = rSum;
      interBuf[dstIdx + 1] = gSum;
      interBuf[dstIdx + 2] = bSum;
      interBuf[dstIdx + 3] = aSum;
    }
  }

  // Pass 2: 垂直方向（Y軸）の面積平均縮小 (tW 維持, origH -> tH)
  const weightsY = precomputeAreaWeights(origH, tH);
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = tW;
  resultCanvas.height = tH;
  const resultCtx = resultCanvas.getContext('2d');
  if (!resultCtx) return resultCanvas;

  const finalImageData = resultCtx.createImageData(tW, tH);
  const dstData = finalImageData.data;

  for (let y = 0; y < tH; y++) {
    const wList = weightsY[y];
    const dstRowOffset = y * tW * 4;

    for (let x = 0; x < tW; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let j = 0; j < wList.length; j++) {
        const item = wList[j];
        const interIdx = item.index * tW * 4 + x * 4;
        const w = item.weight;

        rSum += interBuf[interIdx] * w;
        gSum += interBuf[interIdx + 1] * w;
        bSum += interBuf[interIdx + 2] * w;
        aSum += interBuf[interIdx + 3] * w;
      }

      const dstIdx = dstRowOffset + x * 4;
      if (aSum <= 0.001) {
        dstData[dstIdx] = 0;
        dstData[dstIdx + 1] = 0;
        dstData[dstIdx + 2] = 0;
        dstData[dstIdx + 3] = 0;
      } else {
        const alphaFactor = aSum / 255;
        dstData[dstIdx] = Math.min(255, Math.max(0, Math.round(rSum / alphaFactor)));
        dstData[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(gSum / alphaFactor)));
        dstData[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(bSum / alphaFactor)));
        dstData[dstIdx + 3] = Math.min(255, Math.max(0, Math.round(aSum)));
      }
    }
  }

  resultCtx.putImageData(finalImageData, 0, 0);
  return resultCanvas;
};

/**
 * 高解像度画像を縮小表示する際のモアレ（エイリアシング）を防ぐため、
 * 厳密な Area（面積平均 / INTER_AREA）を用いて高品質な縮小 Canvas を生成します。
 * 画像クロップ画面および画像PDF化画面で共通して使用されます。
 * 
 * @param source 元画像（HTMLImageElement または HTMLCanvasElement）
 * @param targetWidth 縮小先の目標幅 (px)
 * @param targetHeight 縮小先の目標高さ (px)
 * @returns アンチエイリアス（面積平均）処理された HTMLCanvasElement
 */
export const createAntialiasedCanvas = (
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement => {
  return resizeWithAreaAverage(source, targetWidth, targetHeight);
};

/**
 * 画像ファイルを圧縮・JPEG化して DataURL を返します。
 * 最大解像度（デフォルト 1920px）を超える場合は、厳密な Area（面積平均）リサイズを適用して
 * 周期パターンによるモアレ（干渉縞）の発生を防止します。
 * 
 * @param file 圧縮対象のファイル
 * @param maxDimension 最大幅・高さ
 * @returns 圧縮後画像の DataURL
 */
export const compressImage = async (
  file: File | Blob,
  maxDimension: number = IMAGE_CONFIG.MAX_COMPRESS_DIMENSION
): Promise<string> => {
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImageElement(dataUrl);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    let targetBlob: Blob = file;

    // 最大解像度（1920px）を超える場合は、厳密な Area（面積平均）で事前リサイズ
    if (origW > maxDimension || origH > maxDimension) {
      const scale = Math.min(maxDimension / origW, maxDimension / origH);
      const targetW = Math.max(1, Math.round(origW * scale));
      const targetH = Math.max(1, Math.round(origH * scale));

      const antialiasedCanvas = createAntialiasedCanvas(img, targetW, targetH);
      const resizedBlob = await new Promise<Blob | null>((resolve) =>
        antialiasedCanvas.toBlob(resolve, 'image/jpeg', 1.0)
      );

      if (resizedBlob) {
        targetBlob = resizedBlob;
      }
    }

    // browser-image-compression にはリサイズを行わせず、原寸維持（alwaysKeepResolution）で高品質圧縮
    const options = {
      maxSizeMB: Number.POSITIVE_INFINITY,
      useWebWorker: true,
      initialQuality: 1.0,
      alwaysKeepResolution: true,
      fileType: 'image/jpeg',
    };

    const compressedFile = await imageCompression(targetBlob as File, options);
    return await fileToDataUrl(compressedFile);
  } catch (error) {
    console.error('画像圧縮エラー:', error);
    throw error;
  }
};


