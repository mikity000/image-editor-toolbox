import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { PDF_CONFIG } from '../../../shared/constants/Constants';

export interface PdfImageItem {
  dataUrl: string;
  name?: string;
}

export interface UsePdfGeneratorReturn {
  generatePdf: (images: PdfImageItem[], fileName?: string) => Promise<void>;
  generatePdfBlob: (images: PdfImageItem[]) => Promise<Blob | null>;
  isProcessing: boolean;
  progress: number;
}

export function usePdfGenerator(): UsePdfGeneratorReturn {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const generatePdfBlob = useCallback(async (images: PdfImageItem[]): Promise<Blob | null> => {
    if (!images || images.length === 0) return null;

    setIsProcessing(true);
    setProgress(0);

    const { PAGE_WIDTH_A4, UI_YIELD_INTERVAL } = PDF_CONFIG;

    const totalImages = images.length;
    let embeddedCount = 0;

    try {
      const pdfDoc = await PDFDocument.create();

      for (const imageItem of images) {
        try {
          const response = await fetch(imageItem.dataUrl);
          const imageBytes = await response.arrayBuffer();

          // 通常はJPEGとして埋め込み。失敗時はPNG埋め込みも試行
          let image;
          try {
            image = await pdfDoc.embedJpg(imageBytes);
          } catch {
            image = await pdfDoc.embedPng(imageBytes);
          }

          const scaleFactor = PAGE_WIDTH_A4 / image.width;
          const scaledHeight = image.height * scaleFactor;

          const page = pdfDoc.addPage([PAGE_WIDTH_A4, scaledHeight]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: PAGE_WIDTH_A4,
            height: scaledHeight,
          });
        } catch (error) {
          console.error(`画像のPDF埋め込みに失敗しました (${imageItem.name}):`, error);
        } finally {
          embeddedCount++;
          setProgress(Math.round((embeddedCount / totalImages) * 100));

          // UIフリーズ防止のための待機
          if (embeddedCount % UI_YIELD_INTERVAL === 0 || embeddedCount === totalImages) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    } catch (err) {
      console.error('PDF生成処理でエラーが発生しました:', err);
      return null;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  const generatePdf = useCallback(async (images: PdfImageItem[], fileName: string = 'images.pdf') => {
    const blob = await generatePdfBlob(images);
    if (blob) {
      saveAs(blob, fileName);
    }
  }, [generatePdfBlob]);

  return { generatePdf, generatePdfBlob, isProcessing, progress };
}
