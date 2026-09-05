import { useState, useCallback } from 'react';
import { loadPdfDocument, renderPdfPage } from '../utils/pdfRenderUtils';
import { PDF_CONFIG } from '../constants/Constants';

export interface ExtractedPdfImage {
  id: string;
  file: File;
  name: string;
  dataUrl: string;
}

export interface UsePdfExtractorReturn {
  extractImagesFromPdfs: (
    files: File[] | FileList,
    onImagesExtracted?: (images: ExtractedPdfImage[]) => void
  ) => Promise<ExtractedPdfImage[]>;
  isExtracting: boolean;
  extractProgress: number;
}

export function usePdfExtractor(): UsePdfExtractorReturn {
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<number>(0);

  const extractImagesFromPdfs = useCallback(
    async (
      files: File[] | FileList,
      onImagesExtracted?: (images: ExtractedPdfImage[]) => void
    ): Promise<ExtractedPdfImage[]> => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return [];

      setIsExtracting(true);
      setExtractProgress(0);
      const allExtractedImages: ExtractedPdfImage[] = [];

      const { UI_YIELD_INTERVAL } = PDF_CONFIG;

      const totalFiles = fileList.length;
      let completedFiles = 0;

      for (let f = 0; f < totalFiles; f++) {
        const file = fileList[f];
        const currentPdfImages: ExtractedPdfImage[] = [];

        try {
          // PDF.js を用いてPDFドキュメントを読み込み
          const { pdfDoc, numPages } = await loadPdfDocument(file);

          if (numPages === 0) {
            console.warn(`「${file.name}」にはページが存在しません。`);
          } else {
            const baseName = file.name.replace(/\.[^/.]+$/, '');

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
              // 1ページ＝1画像として白背景・高解像度（scale: 2.0）・JPEG形式でレンダリング
              const rendered = await renderPdfPage(pdfDoc, pageNum, {
                scale: 2.0,
                backgroundColor: '#ffffff',
                format: 'image/jpeg',
                quality: 0.92,
              });

              const fileName =
                totalFiles > 1 ? `${baseName}_${pageNum}.jpg` : `${pageNum}.jpg`;
              const extractedFile = new File([rendered.blob], fileName, { type: 'image/jpeg' });

              currentPdfImages.push({
                id: `extracted-${Date.now()}-${f}-${pageNum}-${Math.random().toString(36).slice(2, 9)}`,
                file: extractedFile,
                name: extractedFile.name,
                dataUrl: rendered.dataUrl,
              });

              // ファイル内ページ進捗と全体進捗の算出
              const currentFileProgress = pageNum / numPages;
              const overallProgress = Math.round(
                ((completedFiles + currentFileProgress) / totalFiles) * 100
              );
              setExtractProgress(overallProgress);

              // UIフリーズ防止のための待機
              if (pageNum % UI_YIELD_INTERVAL === 0 || pageNum === numPages) {
                await new Promise((resolve) => setTimeout(resolve, 0));
              }
            }
          }
        } catch (err) {
          console.error(`PDF抽出エラー (${file.name}):`, err);
        }

        if (currentPdfImages.length > 0) {
          allExtractedImages.push(...currentPdfImages);
          if (onImagesExtracted) {
            onImagesExtracted(currentPdfImages);
          }
        }

        completedFiles++;
        setExtractProgress(Math.round((completedFiles / totalFiles) * 100));
      }

      setIsExtracting(false);
      setExtractProgress(0);

      return allExtractedImages;
    },
    []
  );

  return { extractImagesFromPdfs, isExtracting, extractProgress };
}
