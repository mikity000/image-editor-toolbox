import { useState, useCallback } from 'react';
import { upscaleImage, UpscaleOptions } from '../utils/superResolution';

export interface UseSuperResolutionReturn {
  isUpscaling: boolean;
  progress: number;
  statusText: string;
  error: string | null;
  upscale: (
    input: string | Blob | HTMLImageElement,
    scale?: 2 | 4,
    options?: Omit<UpscaleOptions, 'scale' | 'onProgress'>
  ) => Promise<string | null>;
  upscaleBatch: (
    items: Array<{ id: string; dataUrl: string; name?: string }>,
    scale?: 2 | 4,
    options?: Omit<UpscaleOptions, 'scale' | 'onProgress'>
  ) => Promise<Map<string, string>>;
}

/**
 * AI超解像（画像高画質化・拡大）をUIから簡単に利用するためのカスタムフック
 */
export function useSuperResolution(): UseSuperResolutionReturn {
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  /**
   * 単一画像の超解像化
   */
  const upscale = useCallback(
    async (
      input: string | Blob | HTMLImageElement,
      scale: 2 | 4 = 2,
      options?: Omit<UpscaleOptions, 'scale' | 'onProgress'>
    ): Promise<string | null> => {
      setIsUpscaling(true);
      setProgress(0);
      setStatusText(`AIモデル準備中 (${scale}x)...`);
      setError(null);

      try {
        const result = await upscaleImage(input, {
          ...options,
          scale,
          onProgress: (pct) => {
            setProgress(pct);
            if (pct < 10) {
              setStatusText(`AIモデル準備中 (${scale}x)...`);
            } else if (pct < 95) {
              setStatusText(`AI超解像処理中 (${scale}x): ${pct}%`);
            } else {
              setStatusText('画像出力・最適化中...');
            }
          },
        });
        return result;
      } catch (err: any) {
        console.error('超解像処理エラー:', err);
        setError(err?.message || '超解像処理中にエラーが発生しました');
        return null;
      } finally {
        setIsUpscaling(false);
        setProgress(0);
        setStatusText('');
      }
    },
    []
  );

  /**
   * 複数画像の一括超解像化
   */
  const upscaleBatch = useCallback(
    async (
      items: Array<{ id: string; dataUrl: string; name?: string }>,
      scale: 2 | 4 = 2,
      options?: Omit<UpscaleOptions, 'scale' | 'onProgress'>
    ): Promise<Map<string, string>> => {
      const results = new Map<string, string>();
      if (!items || items.length === 0) return results;

      setIsUpscaling(true);
      setProgress(0);
      setError(null);

      const total = items.length;

      try {
        for (let i = 0; i < total; i++) {
          const item = items[i];
          const itemLabel = item.name ? `「${item.name}」` : `${i + 1}/${total}`;
          setStatusText(`超解像処理中 (${i + 1}/${total}枚目: ${itemLabel})...`);

          const upscaled = await upscaleImage(item.dataUrl, {
            ...options,
            scale,
            outputFormat: options?.outputFormat || 'png',
            onProgress: (pct) => {
              const overallPercent = Math.round(((i + pct / 100) / total) * 100);
              setProgress(overallPercent);
            },
          });

          results.set(item.id, upscaled);
          // UIレンダリングの更新を許可
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } catch (err: any) {
        console.error('一括超解像処理エラー:', err);
        setError(err?.message || '一括超解像処理中にエラーが発生しました');
      } finally {
        setIsUpscaling(false);
        setProgress(0);
        setStatusText('');
      }

      return results;
    },
    []
  );

  return {
    isUpscaling,
    progress,
    statusText,
    error,
    upscale,
    upscaleBatch,
  };
}
