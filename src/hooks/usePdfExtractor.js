import { useState } from 'react';
import { PDFDocument, PDFName } from 'pdf-lib';

export function usePdfExtractor() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  const extractImagesFromPdf = async (file) => {
    setIsExtracting(true);
    setExtractProgress(0);
    const extractedImages = [];

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
      
      const imageObjects = [];
      indirectObjects.forEach(([ref, obj]) => {
        if (obj?.constructor?.name === 'PDFRawStream') {
          const dict = obj.dict;
          const subtype = dict.get(PDFName.of('Subtype'));
          const filter = dict.get(PDFName.of('Filter'));
          
          if (subtype === PDFName.of('Image') && filter === PDFName.of('DCTDecode')) {
            imageObjects.push(obj);
          }
        }
      });

      const total = imageObjects.length;
      if (total === 0) {
        alert('このPDFからは抽出可能な画像（JPEG形式）が見つかりませんでした。');
        return extractedImages;
      }

      for (let i = 0; i < total; i++) {
        const obj = imageObjects[i];
        const imageBytes = obj.contents;
        const blob = new Blob([imageBytes], { type: 'image/jpeg' });
        
        // DataURLへの変換
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // アプリ内の形式に合わせるためFileオブジェクトを作成
        const extractedFile = new File([blob], `${i + 1}.jpg`, { type: 'image/jpeg' });

        extractedImages.push({
          id: URL.createObjectURL(blob),
          file: extractedFile,
          name: extractedFile.name,
          dataUrl: dataUrl,
        });
        
        setExtractProgress(Math.round(((i + 1) / total) * 100));

        // ブラウザのフリーズを防ぐための微小な待機
        if ((i + 1) % 3 === 0 || i + 1 === total) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

    } catch (err) {
      console.error('PDF Extraction failed:', err);
      alert('PDFの読み込みに失敗しました。');
    } finally {
      setIsExtracting(false);
      setExtractProgress(0);
    }
    
    return extractedImages;
  };

  return { extractImagesFromPdf, isExtracting, extractProgress };
}
