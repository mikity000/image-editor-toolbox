/**
 * PDFレンダリングユーティリティ
 * PDF.js を動的にロードし、PDFファイルの各ページをCanvas/画像としてレンダリングします。
 */

let pdfjsLoadingPromise: Promise<any> | null = null;

/**
 * PDF.js ライブラリを動的にロードします。
 * @returns pdfjsLib インスタンス
 */
export async function loadPdfJs(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  if (pdfjsLoadingPromise) {
    return pdfjsLoadingPromise;
  }

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;

    script.onload = () => {
      if ((window as any).pdfjsLib) {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve((window as any).pdfjsLib);
      } else {
        reject(new Error('PDF.js の読み込みに失敗しました。'));
      }
    };

    script.onerror = (err) => {
      pdfjsLoadingPromise = null;
      reject(new Error(`PDF.js スクリプトの読み込みエラー: ${err}`));
    };

    document.head.appendChild(script);
  });

  return pdfjsLoadingPromise;
}

export interface LoadedPdfDocument {
  pdfDoc: any;
  numPages: number;
}

/**
 * File または ArrayBuffer から PDFDocumentProxy を読み込みます。
 * @param fileOrBuffer
 */
export async function loadPdfDocument(fileOrBuffer: File | Blob | ArrayBuffer): Promise<LoadedPdfDocument> {
  const pdfjs = await loadPdfJs();
  let arrayBuffer: ArrayBuffer;

  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer instanceof Blob) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    throw new Error('サポートされていないファイル形式です。');
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  return {
    pdfDoc,
    numPages: pdfDoc.numPages,
  };
}

export interface RenderedPdfPage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * 指定したページ番号の PDF ページを Canvas にレンダリングし、DataURL を返します。
 * @param pdfDoc PDFDocumentProxy
 * @param pageNumber 1始まりのページ番号
 * @param scale レンダリングスケール (デフォルト 2.0 で高解像度化)
 */
export async function renderPdfPage(pdfDoc: any, pageNumber: number, scale: number = 2.0): Promise<RenderedPdfPage> {
  if (!pdfDoc || pageNumber < 1 || pageNumber > pdfDoc.numPages) {
    throw new Error(`無効なページ番号です: ${pageNumber}`);
  }

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext).promise;

  const dataUrl = canvas.toDataURL('image/png');
  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}
