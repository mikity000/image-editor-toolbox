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
    maxWidthOrHeight: 1920,              // 大きすぎる画像だけリサイズ
    useWebWorker: true,                  // Web Worker で非同期処理
    initialQuality: 1.0,                 // 画質劣化なし
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
