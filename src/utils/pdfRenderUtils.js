/**
 * PDFレンダリングユーティリティ
 * PDF.js を動的にロードし、PDFファイルの各ページをCanvas/画像としてレンダリングします。
 */

let pdfjsLoadingPromise = null;

/**
 * PDF.js ライブラリを動的にロードします。
 * @returns {Promise<any>} pdfjsLib インスタンス
 */
export async function loadPdfJs() {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    return window.pdfjsLib;
  }

  if (pdfjsLoadingPromise) {
    return pdfjsLoadingPromise;
  }

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;

    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
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

/**
 * File または ArrayBuffer から PDFDocumentProxy を読み込みます。
 * @param {File|Blob|ArrayBuffer} fileOrBuffer
 * @returns {Promise<{ pdfDoc: any, numPages: number }>}
 */
export async function loadPdfDocument(fileOrBuffer) {
  const pdfjs = await loadPdfJs();
  let arrayBuffer;

  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer instanceof Blob || fileOrBuffer instanceof File) {
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

/**
 * 指定したページ番号の PDF ページを Canvas にレンダリングし、DataURL を返します。
 * @param {any} pdfDoc PDFDocumentProxy
 * @param {number} pageNumber 1始まりのページ番号
 * @param {number} scale レンダリングスケール (デフォルト 2.0 で高解像度化)
 * @returns {Promise<{ dataUrl: string, width: number, height: number }>}
 */
export async function renderPdfPage(pdfDoc, pageNumber, scale = 2.0) {
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
