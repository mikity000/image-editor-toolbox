import { fileToDataUrl } from './imageUtils';
import { IMAGE_CONFIG } from '../constants/Constants';
import type { WebpWorkerResponse, WebpWorkerRequest } from './webp.worker';

// Web Worker のインスタンス管理用インターフェース
interface WorkerItem {
  worker: Worker;
  isBusy: boolean;
}

interface QueuedTask {
  messageId: string;
  payload: WebpWorkerRequest;
  transferables: Transferable[];
  timeout: number;
  onProgress?: (progress: number) => void;
  resolve: (resultDataUrl: string) => void;
  reject: (error: Error) => void;
}

/**
 * 端末のCPUコア数に応じたマルチWorkerプールおよびキュー制御クラス
 */
class WebpWorkerPool {
  private workers: WorkerItem[] = [];
  private queue: QueuedTask[] = [];
  private maxWorkers: number;

  constructor(maxWorkers: number = IMAGE_CONFIG.MAX_WEBP_WORKERS) {
    const concurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? Math.max(1, Math.min(navigator.hardwareConcurrency, maxWorkers))
      : 2;
    this.maxWorkers = concurrency;
  }

  private createWorkerItem(): WorkerItem {
    const worker = new Worker(new URL('./webp.worker.ts', import.meta.url));
    const item: WorkerItem = { worker, isBusy: false };
    return item;
  }

  public enqueue(
    payload: WebpWorkerRequest,
    transferables: Transferable[],
    timeout: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.queue.push({
        messageId: payload.id,
        payload,
        transferables,
        timeout,
        onProgress,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0) return;

    // 空いている Worker を探す
    let availableWorker = this.workers.find(w => !w.isBusy);

    // 空き Worker がなく、まだ最大数に達していなければ新規作成
    if (!availableWorker && this.workers.length < this.maxWorkers) {
      availableWorker = this.createWorkerItem();
      this.workers.push(availableWorker);
    }

    if (!availableWorker) {
      // すべての Worker がビジー状態なので空きが出るまでキューで待機
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    availableWorker.isBusy = true;
    this.runTask(availableWorker, task);
  }

  private runTask(workerItem: WorkerItem, task: QueuedTask) {
    const { worker } = workerItem;
    const { messageId, payload, transferables, timeout, onProgress, resolve, reject } = task;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      workerItem.isBusy = false;
      // 次のキューを処理
      this.processQueue();
    };

    const handleMessage = async (e: MessageEvent<WebpWorkerResponse>) => {
      const { id, type } = e.data || {};
      if (id !== messageId) return;

      cleanup();

      if (type === 'SUCCESS') {
        const successData = e.data as import('./webp.worker').WebpWorkerSuccessResponse;
        if (onProgress) onProgress(90);
        try {
          const blob = new Blob([successData.data], { type: 'image/webp' });
          const resultDataUrl = await fileToDataUrl(blob);
          if (onProgress) onProgress(100);
          resolve(resultDataUrl);
        } catch (err: any) {
          if (onProgress) onProgress(0);
          reject(err);
        }
      } else {
        const errorData = e.data as import('./webp.worker').WebpWorkerErrorResponse;
        if (onProgress) onProgress(0);
        reject(new Error(errorData?.error || 'WebPへの変換に失敗しました。'));
      }
    };

    const handleError = (err: ErrorEvent) => {
      cleanup();
      // Worker クラッシュ時は安全に破棄して再生成対象とする
      try {
        worker.terminate();
      } catch (e) {
        // ignore
      }
      const idx = this.workers.indexOf(workerItem);
      if (idx !== -1) {
        this.workers.splice(idx, 1);
      }

      if (onProgress) onProgress(0);
      reject(new Error(err.message || 'Worker処理中にエラーが発生しました。'));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    // タイムアウト設定: 待機時間ではなく、実際に Worker でエンコードが開始されてからの時間を計測
    if (timeout > 0) {
      timer = setTimeout(() => {
        cleanup();
        // タイムアウト時は Worker を強制終了して再生成対象とする
        try {
          worker.terminate();
        } catch (e) {
          // ignore
        }
        const idx = this.workers.indexOf(workerItem);
        if (idx !== -1) {
          this.workers.splice(idx, 1);
        }

        if (onProgress) onProgress(0);
        reject(new Error('WebP変換がタイムアウトしました。'));
      }, timeout);
    }

    if (onProgress) onProgress(50);

    // ImageDataのピクセルデータをTransferableオブジェクトとして転送
    worker.postMessage(payload, transferables);
  }
}

// シングルトンのWorkerPoolインスタンス
const workerPool = new WebpWorkerPool();

// DataURLをロードしてImageDataを取得する
function dataUrlToImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2Dコンテキストの取得に失敗しました。'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
    img.src = dataUrl;
  });
}

// CanvasからImageDataを取得する
function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2Dコンテキストの取得に失敗しました。');
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export interface ConvertToWebPOptions {
  quality?: number;
  timeout?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Canvas または DataURL を高品質な WebP (DataURL) に非同期で変換します。
 * Worker プールとキュー制御を使用してメインスレッドのブロッキングを防ぎ、並列処理を高速化します。
 * 
 * @param canvasOrDataUrl 変換対象のCanvasまたはDataURL
 * @param options オプション
 * @returns WebP の DataURL
 */
export async function convertToWebP(
  canvasOrDataUrl: HTMLCanvasElement | string,
  options: ConvertToWebPOptions = {}
): Promise<string> {
  const { 
    quality = IMAGE_CONFIG.DEFAULT_WEBP_QUALITY, 
    timeout = IMAGE_CONFIG.WEBP_WORKER_TIMEOUT_MS, 
    onProgress 
  } = options;

  if (onProgress) onProgress(10);

  let imageData: ImageData;
  try {
    if (typeof canvasOrDataUrl === 'string') {
      imageData = await dataUrlToImageData(canvasOrDataUrl);
    } else if (canvasOrDataUrl instanceof HTMLCanvasElement) {
      imageData = canvasToImageData(canvasOrDataUrl);
    } else {
      throw new Error('無効な入力です。CanvasまたはDataURLを指定してください。');
    }
  } catch (err) {
    if (onProgress) onProgress(0);
    throw err;
  }

  if (onProgress) onProgress(30);

  const messageId = Math.random().toString(36).slice(2, 11);
  const requestPayload: WebpWorkerRequest = {
    id: messageId,
    width: imageData.width,
    height: imageData.height,
    data: imageData.data.buffer,
    quality
  };

  return workerPool.enqueue(requestPayload, [imageData.data.buffer], timeout, onProgress);
}
