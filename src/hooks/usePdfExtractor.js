import { useState, useCallback } from 'react';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { fileToDataUrl } from '../utils/imageUtils';
import { PDF_CONFIG } from '../constants/Constants';

export function usePdfExtractor() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  const extractImagesFromPdfs = useCallback(async (files, onImagesExtracted) => {
    if (!files || files.length === 0) return [];

    setIsExtracting(true);
    setExtractProgress(0);
    const allExtractedImages = [];
    
    const { UI_YIELD_INTERVAL } = PDF_CONFIG;

    const totalFiles = files.length;
    let completedFiles = 0;

    for (let f = 0; f < totalFiles; f++) {
      const file = files[f];
      const currentPdfImages = [];

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
        
        const imageObjects = [];
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
            const blob = new Blob([imageBytes], { type: 'image/jpeg' });
            
            const dataUrl = await fileToDataUrl(blob);
            const fileName = totalFiles > 1 ? `${file.name.replace(/\.[^/.]+$/, '')}_${i + 1}.jpg` : `${i + 1}.jpg`;
            const extractedFile = new File([blob], fileName, { type: 'image/jpeg' });

            currentPdfImages.push({
              id: `extracted-${Date.now()}-${f}-${i}-${Math.random().toString(36).slice(2, 9)}`,
              file: extractedFile,
              name: extractedFile.name,
              dataUrl,
            });
            
            const currentFileProgress = (i + 1) / totalImagesInFile;
            const overallProgress = Math.round(((completedFiles + currentFileProgress) / totalFiles) * 100);
            setExtractProgress(overallProgress);

            if ((i + 1) % UI_YIELD_INTERVAL === 0 || i + 1 === totalImagesInFile) {
              await new Promise(resolve => setTimeout(resolve, 0));
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
  }, []);

  return { extractImagesFromPdfs, isExtracting, extractProgress };
}

