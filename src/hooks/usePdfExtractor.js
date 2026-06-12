import { useState } from 'react';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { fileToDataUrl } from '../utils/imageUtils';

export function usePdfExtractor() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  const extractImagesFromPdfs = async (files, onImagesExtracted) => {
    setIsExtracting(true);
    setExtractProgress(0);
    const allExtractedImages = [];
    
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
        indirectObjects.forEach(([ref, obj]) => {
          if (obj instanceof PDFRawStream) {
            const dict = obj.dict;
            const subtype = dict.get(PDFName.of('Subtype'));
            
            if (subtype === PDFName.of('Image')) {
              imageObjects.push(obj);
            }
          }
        });

        const totalImagesInFile = imageObjects.length;
        if (totalImagesInFile === 0) {
          alert(`「${file.name}」から抽出可能な画像は見つかりませんでした。`);
        } else {
          for (let i = 0; i < totalImagesInFile; i++) {
            const obj = imageObjects[i];
            const imageBytes = obj.contents;
            const blob = new Blob([imageBytes], { type: 'image/jpeg' });
            
            // DataURLへの変換
            const dataUrl = await fileToDataUrl(blob);

            // アプリ内の形式に合わせるためFileオブジェクトを作成
            const extractedFile = new File([blob], `${i + 1}.jpg`, { type: 'image/jpeg' });

            currentPdfImages.push({
              id: URL.createObjectURL(blob),
              file: extractedFile,
              name: extractedFile.name,
              dataUrl: dataUrl,
            });
            
            // 進捗の計算: 完了したファイル数と現在のファイルの画像抽出進捗を組み合わせる
            const currentFileProgress = (i + 1) / totalImagesInFile;
            const overallProgress = Math.round(((completedFiles + currentFileProgress) / totalFiles) * 100);
            setExtractProgress(overallProgress);

            // ブラウザのフリーズを防ぐための微小な待機
            if ((i + 1) % 3 === 0 || i + 1 === totalImagesInFile) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        }
      } catch (err) {
        console.error(`PDF Extraction failed for ${file.name}:`, err);
        alert(`${file.name}の読み込みに失敗しました。`);
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
  };

  return { extractImagesFromPdfs, isExtracting, extractProgress };
}
