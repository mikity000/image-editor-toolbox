import imageCompression from 'browser-image-compression';

export const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const options = {
      maxSizeMB: Number.POSITIVE_INFINITY,  // サイズ制限なし（品質優先）
      maxWidthOrHeight: 1920,               // 大きすぎる画像だけリサイズ
      useWebWorker: true,                   // Web Worker で非同期処理
      initialQuality: 1.0,                  // 画質劣化なし
      fileType: 'image/jpeg',                // jpegかpngしかPDF化できないからjpegに出力フォーマットを固定
    };

    imageCompression(file, options).then(function (compressedFile) {
      // 圧縮されたBlobをData URLに変換
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    }).catch(function (error) {
      console.error('画像圧縮エラー:', error);
      reject(error);
    });
  });
};

export const getSequentialName = (baseName, galleryImages) => {
  const base = baseName.split('.')[0];
  const regex = new RegExp(`^${base}_(\\d+)$`);
  let maxNum = 0;
  
  galleryImages.forEach(img => {
    if (img && img.name) {
      const match = img.name.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });
  
  return `${base}_${maxNum + 1}`;
};
