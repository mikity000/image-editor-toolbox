import { encode } from '@jsquash/webp';

export interface WebpWorkerRequest {
  id: string;
  width: number;
  height: number;
  data: ArrayBuffer | Uint8ClampedArray | number[];
  quality?: number;
}

export interface WebpWorkerSuccessResponse {
  id: string;
  type: 'SUCCESS';
  data: ArrayBuffer;
}

export interface WebpWorkerErrorResponse {
  id: string;
  type: 'ERROR';
  error?: string;
}

export type WebpWorkerResponse = WebpWorkerSuccessResponse | WebpWorkerErrorResponse;

interface WorkerContext {
  addEventListener(type: 'message', listener: (e: MessageEvent<WebpWorkerRequest>) => void | Promise<void>): void;
  postMessage(message: WebpWorkerResponse, transfer?: Transferable[]): void;
}

// eslint-disable-next-line no-restricted-globals
const ctx: WorkerContext = self as any;

ctx.addEventListener('message', async (e: MessageEvent<WebpWorkerRequest>) => {
  const { id, width, height, data, quality } = e.data;

  try {
    const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
    const webpBuffer = await encode(imageData, { quality });

    ctx.postMessage(
      {
        id,
        type: 'SUCCESS',
        data: webpBuffer,
      },
      [webpBuffer]
    );
  } catch (err: any) {
    ctx.postMessage({
      id,
      type: 'ERROR',
      error: err?.message || 'WebP変換エラーが発生しました。',
    });
  }
});
