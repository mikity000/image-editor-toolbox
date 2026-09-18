import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { PDF_CONFIG } from '../constants/Constants';
import { upscaleImage, calculateMaxReferenceSize, evaluateRelativeResolution, getImageDimensions } from '../utils/superResolution';

export interface PdfImageItem {
  dataUrl: string;
  name?: string;
  width?: number;
  height?: number;
}

export interface PdfGenerateOptions {
  autoUpscale?: boolean; // 低解像度画像の自動AI超解像
  fitMode?: 'fitWidth' | 'containA4'; // 配置モード（A4幅フィット or A4用紙内中央配置）
}

export interface UsePdfGeneratorReturn {
  generatePdf: (images: PdfImageItem[], options?: PdfGenerateOptions) => Promise<void>;
  isProcessing: boolean;
  progress: number;
  statusText: string;
}

/**
 * 画像DataURLをHTMLImageElementとCanvasを経由してPNG/JPEGのArrayBufferに変換します。
 * pdf-libがWebP等の非対応形式を直接embedできない問題のフォールバックとして使用します。
 */
async function convertDataUrlToFallbackBytes(
  dataUrl: string,
  format: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D contextの取得に失敗しました'));
        return;
      }
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Blob生成に失敗しました'));
            return;
          }
          const buf = await blob.arrayBuffer();
          resolve(buf);
        },
        format,
        format === 'image/jpeg' ? 0.95 : undefined
      );
    };
    img.onerror = (e) => reject(new Error('フォールバック画像読み込みエラー: ' + e));
    img.src = dataUrl;
  });
}

export function usePdfGenerator(): UsePdfGeneratorReturn {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');

  const generatePdf = useCallback(
    async (images: PdfImageItem[], options: PdfGenerateOptions = {}) => {
      if (!images || images.length === 0) return;

      const { autoUpscale = false, fitMode = 'fitWidth' } = options;
      const { PAGE_WIDTH_A4, PAGE_HEIGHT_A4, UI_YIELD_INTERVAL } = PDF_CONFIG;

      setIsProcessing(true);
      setProgress(0);
      setStatusText('PDF生成の準備中...');

      const totalImages = images.length;
      let processedCount = 0;

      try {
        const pdfDoc = await PDFDocument.create();

        // 自動AI超解像が有効な場合、全画像の最大基準サイズ（長辺最大値）を事前に算出
        let maxReferenceSize = 0;
        const imageDimensions: Array<{ width: number; height: number }> = [];

        if (autoUpscale) {
          setStatusText('画像解像度を分析中...');
          for (let i = 0; i < totalImages; i++) {
            const imgItem = images[i];
            if (imgItem.width && imgItem.height) {
              imageDimensions[i] = { width: imgItem.width, height: imgItem.height };
            } else {
              try {
                const dims = await getImageDimensions(imgItem.dataUrl);
                imageDimensions[i] = dims;
              } catch {
                imageDimensions[i] = { width: 9999, height: 9999 };
              }
            }
          }
          maxReferenceSize = calculateMaxReferenceSize(imageDimensions);
        }

        for (let i = 0; i < totalImages; i++) {
          const imageItem = images[i];
          let currentDataUrl = imageItem.dataUrl;

          // 自動AI超解像処理の適用判定（一番大きい画像基準の相対判定）
          if (autoUpscale && maxReferenceSize > 0) {
            try {
              const dims = imageDimensions[i] || { width: 9999, height: 9999 };
              const { isLowRes, recommendedScale } = evaluateRelativeResolution(dims.width, dims.height, maxReferenceSize);

              if (isLowRes && recommendedScale) {
                setStatusText(`低解像度画像をAI高画質化中 (${i + 1}/${totalImages}枚目: ${recommendedScale}x)...`);

                const upscaledUrl = await upscaleImage(currentDataUrl, {
                  scale: recommendedScale,
                  outputFormat: 'png', // PDF埋め込み用にPNG固定
                  onProgress: (pct) => {
                    const stepProgress = Math.round(((i + pct / 100) / totalImages) * 100);
                    setProgress(stepProgress);
                  },
                });
                currentDataUrl = upscaledUrl;
              }
            } catch (upscaleErr) {
              console.warn(`画像のAI超解像に失敗したため元画像を使用します (${imageItem.name}):`, upscaleErr);
            }
          }

          setStatusText(`PDFページ作成中 (${i + 1}/${totalImages}枚目)...`);

          try {
            const response = await fetch(currentDataUrl);
            const imageBytes = await response.arrayBuffer();

            // 通常はJPEGとして埋め込み。失敗時はPNG埋め込みを試行し、WebP等の非対応形式はCanvas経由でPNGに変換
            let image;
            try {
              image = await pdfDoc.embedJpg(imageBytes);
            } catch {
              try {
                image = await pdfDoc.embedPng(imageBytes);
              } catch {
                // WebP等の非対応形式に対するフォールバック
                const fallbackBytes = await convertDataUrlToFallbackBytes(currentDataUrl, 'image/png');
                image = await pdfDoc.embedPng(fallbackBytes);
              }
            }

            if (fitMode === 'containA4') {
              // A4定型用紙（595.28 x 841.89 pt）の枠内に余白を持って中央配置
              const maxWidth = PAGE_WIDTH_A4 - 40; // 左右マージン各20pt
              const maxHeight = PAGE_HEIGHT_A4 - 40; // 上下マージン各20pt
              const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

              const drawWidth = image.width * scale;
              const drawHeight = image.height * scale;
              const x = (PAGE_WIDTH_A4 - drawWidth) / 2;
              const y = (PAGE_HEIGHT_A4 - drawHeight) / 2;

              const page = pdfDoc.addPage([PAGE_WIDTH_A4, PAGE_HEIGHT_A4]);
              page.drawImage(image, {
                x,
                y,
                width: drawWidth,
                height: drawHeight,
              });
            } else {
              // 用紙幅いっぱいに拡大（従来仕様・アスペクト比維持）
              const scaleFactor = PAGE_WIDTH_A4 / image.width;
              const scaledHeight = image.height * scaleFactor;

              const page = pdfDoc.addPage([PAGE_WIDTH_A4, scaledHeight]);
              page.drawImage(image, {
                x: 0,
                y: 0,
                width: PAGE_WIDTH_A4,
                height: scaledHeight,
              });
            }
          } catch (error) {
            console.error(`画像のPDF埋め込みに失敗しました (${imageItem.name}):`, error);
          } finally {
            processedCount++;
            setProgress(Math.round((processedCount / totalImages) * 100));

            // UIフリーズ防止のための待機
            if (processedCount % UI_YIELD_INTERVAL === 0 || processedCount === totalImages) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        }

        setStatusText('PDFファイルを書き出し中...');
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        saveAs(blob, 'images.pdf');
      } catch (err) {
        console.error('PDF生成処理全体でエラーが発生しました:', err);
      } finally {
        setIsProcessing(false);
        setProgress(0);
        setStatusText('');
      }
    },
    []
  );

  return { generatePdf, isProcessing, progress, statusText };
}
