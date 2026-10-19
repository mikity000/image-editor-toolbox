import imageCompression from 'browser-image-compression';

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
 * 画像ファイルを圧縮・JPEG化して DataURL を返します。
 * @param file 圧縮対象のファイル
 * @returns 圧縮後画像の DataURL
 */
export const compressImage = async (file: File | Blob): Promise<string> => {
  const options = {
    maxSizeMB: Number.POSITIVE_INFINITY, // サイズ制限なし（品質優先）
    useWebWorker: true,                  // Web Worker で非同期処理
    initialQuality: 1.0,                 // 画質劣化なし
    alwaysKeepResolution: true,          // 原寸解像度を維持（リサイズ・間引きなし）
    fileType: 'image/jpeg',              // PDF埋め込み用にJPEG固定
  };

  try {
    const compressedFile = await imageCompression(file as File, options);
    return await fileToDataUrl(compressedFile);
  } catch (error) {
    console.error('画像圧縮エラー:', error);
    throw error;
  }
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
 * 高解像度画像を縮小表示する際のモアレ（エイリアシング）を防ぐため、
 * 段階的ダウンサンプリング（Step-down / Halving）を行って高品質な縮小 Canvas を生成します。
 * 
 * @param source 元画像（HTMLImageElement または HTMLCanvasElement）
 * @param targetWidth 縮小先の目標幅 (px)
 * @param targetHeight 縮小先の目標高さ (px)
 * @returns アンチエイリアス処理された HTMLCanvasElement
 */
export const createAntialiasedCanvas = (
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement => {
  const origW = (source as HTMLImageElement).naturalWidth || source.width;
  const origH = (source as HTMLImageElement).naturalHeight || source.height;

  const tW = Math.max(1, Math.round(targetWidth));
  const tH = Math.max(1, Math.round(targetHeight));

  // 縮小率が緩やかな場合（目標サイズが元の50%以上）は単一段階で高品質描画
  if (origW <= tW * 2 && origH <= tH * 2) {
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

  // 1回の縮小率が0.5倍（半分）を超えないように50%ずつ段階的縮小（ボックス平均化フィルタ）
  let curW = origW;
  let curH = origH;

  let currentCanvas = document.createElement('canvas');
  currentCanvas.width = curW;
  currentCanvas.height = curH;
  const currentCtx = currentCanvas.getContext('2d');
  if (currentCtx) {
    currentCtx.drawImage(source, 0, 0);
  }

  while (curW * 0.5 > tW && curH * 0.5 > tH) {
    const nextW = Math.max(tW, Math.round(curW * 0.5));
    const nextH = Math.max(tH, Math.round(curH * 0.5));

    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d');

    if (stepCtx) {
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(currentCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
    }

    currentCanvas = stepCanvas;
    curW = nextW;
    curH = nextH;
  }

  // 最終目標サイズへの縮小
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = tW;
  finalCanvas.height = tH;
  const finalCtx = finalCanvas.getContext('2d');
  if (finalCtx) {
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(currentCanvas, 0, 0, curW, curH, 0, 0, tW, tH);
  }

  return finalCanvas;
};

