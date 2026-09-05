import { useState, useCallback } from 'react';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { fileToDataUrl } from '../utils/imageUtils';
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
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const indirectObjects = pdfDoc.context.enumerateIndirectObjects();

          const imageObjects: PDFRawStream[] = [];
          indirectObjects.forEach(([, obj]) => {
            if (obj instanceof PDFRawStream) {
              const subtype = obj.dict.get(PDFName.of('Subtype'));
              if (subtype === PDFName.of('Image')) {
                imageObjects.push(obj);
              }
            }
          });

          const totalImagesInFile = imageObjects.length;
          if (totalImagesInFile === 0) {
            console.warn(`「${file.name}」から抽出可能な画像は見つかりませんでした。`);
          } else {
            for (let i = 0; i < totalImagesInFile; i++) {
              const obj = imageObjects[i];
              const imageBytes = obj.contents;
              const blob = new Blob([imageBytes as any], { type: 'image/jpeg' });

              const dataUrl = await fileToDataUrl(blob);
              const fileName =
                totalFiles > 1 ? `${file.name.replace(/\.[^/.]+$/, '')}_${i + 1}.jpg` : `${i + 1}.jpg`;
              const extractedFile = new File([blob], fileName, { type: 'image/jpeg' });

              currentPdfImages.push({
                id: `extracted-${Date.now()}-${f}-${i}-${Math.random().toString(36).slice(2, 9)}`,
                file: extractedFile,
                name: extractedFile.name,
                dataUrl,
              });

              const currentFileProgress = (i + 1) / totalImagesInFile;
              const overallProgress = Math.round(
                ((completedFiles + currentFileProgress) / totalFiles) * 100
              );
              setExtractProgress(overallProgress);

              if ((i + 1) % UI_YIELD_INTERVAL === 0 || i + 1 === totalImagesInFile) {
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
