import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

export function usePdfGenerator() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const generatePdf = async (images) => {
    if (images.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const pdfDoc = await PDFDocument.create();
      const desiredWidth = 595.28; // A4幅 (約210mm) のPDFポイント
      const totalImages = images.length;
      let embeddedCount = 0;

      for (const imageItem of images) {
        try {
          const imageBytes = await fetch(imageItem.dataUrl).then(res => res.arrayBuffer());
          const image = await pdfDoc.embedJpg(imageBytes);

          const originalWidth = image.width;
          const originalHeight = image.height;
          const scaleFactor = desiredWidth / originalWidth;
          const scaledHeight = originalHeight * scaleFactor;

          const page = pdfDoc.addPage([desiredWidth, scaledHeight]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: desiredWidth,
            height: scaledHeight,
          });

          embeddedCount++;
          setProgress(Math.round((embeddedCount / totalImages) * 100));

          if (embeddedCount % 3 === 0 || embeddedCount === totalImages) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } catch (error) {
          console.error(`Error embedding image ${imageItem.name}:`, error);
          embeddedCount++;
          setProgress(Math.round((embeddedCount / totalImages) * 100));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'images.pdf');
    } catch (err) {
      console.error('PDF Generation failed:', err);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return { generatePdf, isProcessing, progress };
}
