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

export interface RenderPdfPageOptions {
  scale?: number;
  backgroundColor?: string;
  format?: 'image/jpeg' | 'image/png';
  quality?: number;
}

export interface RenderedPdfPage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * 指定したページ番号の PDF ページを Canvas にレンダリングし、DataURL と Blob を返します。
 * @param pdfDoc PDFDocumentProxy
 * @param pageNumber 1始まりのページ番号
 * @param scaleOrOptions レンダリングスケールまたはオプション
 */
export async function renderPdfPage(
  pdfDoc: any,
  pageNumber: number,
  scaleOrOptions: number | RenderPdfPageOptions = 2.0
): Promise<RenderedPdfPage> {
  if (!pdfDoc || pageNumber < 1 || pageNumber > pdfDoc.numPages) {
    throw new Error(`無効なページ番号です: ${pageNumber}`);
  }

  const options: RenderPdfPageOptions =
    typeof scaleOrOptions === 'number' ? { scale: scaleOrOptions } : scaleOrOptions;

  const scale = options.scale ?? 2.0;
  const backgroundColor = options.backgroundColor ?? '#ffffff';
  const format = options.format ?? 'image/jpeg';
  const quality = options.quality ?? 0.92;

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D コンテキストの取得に失敗しました。');
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  // 透過背景対策：下地を背景色（デフォルト白）で塗りつぶし
  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext).promise;

  const dataUrl = canvas.toDataURL(format, quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error('Canvas から Blob への変換に失敗しました。'));
        }
      },
      format,
      quality
    );
  });

  // Canvas メモリの解放
  canvas.width = 0;
  canvas.height = 0;

  return {
    dataUrl,
    blob,
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  };
}
