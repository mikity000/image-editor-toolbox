import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Layers,
  Loader2,
} from 'lucide-react';
import { loadPdfDocument, renderPdfPage, RenderedPdfPage } from '../utils/pdfRenderUtils';

export interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  onDownload: () => void;
  isDownloading?: boolean;
}

type ViewMode = 'single' | 'continuous';

interface PageRenderItem {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

const BASE_PAGE_WIDTH = 800;

export default function PdfPreviewModal({
  isOpen,
  onClose,
  pdfBlob,
  onDownload,
  isDownloading = false,
}: PdfPreviewModalProps): React.ReactElement | null {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [scale, setScale] = useState<number>(1.0);
  const [renderedPages, setRenderedPages] = useState<PageRenderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isCtrlPressedRef = useRef<boolean>(false);
  const isZoomingRef = useRef<boolean>(false);
  const isZoomingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentPageRef = useRef<number>(1);
  const zoomAnchorRef = useRef<{ pageNum: number; relativeTop: number } | null>(null);

  // currentPageを常にrefに同期
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // PDF.jsドキュメントの読み込みと全ページレンダリング
  useEffect(() => {
    if (!isOpen || !pdfBlob) {
      setRenderedPages([]);
      setNumPages(0);
      setCurrentPage(1);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadingProgress(0);
    setError(null);

    const loadAndRender = async () => {
      try {
        const { pdfDoc, numPages: total } = await loadPdfDocument(pdfBlob);
        if (!isMounted) return;

        setNumPages(total);
        const pages: PageRenderItem[] = [];

        // ページを順次レンダリング
        for (let i = 1; i <= total; i++) {
          if (!isMounted) return;
          // 高精細レンダリングのためscale=2.0で描画
          const rendered: RenderedPdfPage = await renderPdfPage(pdfDoc, i, {
            scale: 2.0,
            format: 'image/jpeg',
            quality: 0.92,
          });

          pages.push({
            pageNumber: i,
            dataUrl: rendered.dataUrl,
            width: rendered.width,
            height: rendered.height,
          });

          setLoadingProgress(Math.round((i / total) * 100));
        }

        if (isMounted) {
          setRenderedPages(pages);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('PDFプレビューの生成に失敗しました:', err);
        if (isMounted) {
          setError(err?.message || 'PDFプレビューの生成に失敗しました。');
          setIsLoading(false);
        }
      }
    };

    loadAndRender();

    return () => {
      isMounted = false;
    };
  }, [isOpen, pdfBlob]);

  // 前のページへ
  const handlePrevPage = useCallback(() => {
    if (viewMode === 'continuous') {
      const targetPage = Math.max(1, currentPage - 1);
      setCurrentPage(targetPage);
      const el = pageRefs.current.get(targetPage);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  }, [viewMode, currentPage]);

  // 次のページへ
  const handleNextPage = useCallback(() => {
    if (viewMode === 'continuous') {
      const targetPage = Math.min(numPages, currentPage + 1);
      setCurrentPage(targetPage);
      const el = pageRefs.current.get(targetPage);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setCurrentPage((prev) => Math.min(numPages, prev + 1));
    }
  }, [viewMode, currentPage, numPages]);

  // ズーム直前の基準ページ（画面内に見えているページ）とその相対位置を記録
  const captureZoomAnchor = useCallback(() => {
    if (viewMode !== 'continuous' || !containerRef.current) return;
    const container = containerRef.current;
    const containerTop = container.getBoundingClientRect().top;

    // 現在見えているページ（上端に最も近いページ）を取得
    let bestPage = currentPageRef.current;
    let minDistance = Infinity;

    pageRefs.current.forEach((el, pageNum) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        // コンテナの視界上端付近にあるページを最優先で探索
        const distance = Math.abs(rect.top - containerTop - 30);
        if (distance < minDistance) {
          minDistance = distance;
          bestPage = pageNum;
        }
      }
    });

    const targetEl = pageRefs.current.get(bestPage);
    if (targetEl) {
      const relativeTop = targetEl.getBoundingClientRect().top - containerTop;
      zoomAnchorRef.current = {
        pageNum: bestPage,
        relativeTop,
      };
    }
  }, [viewMode]);

  // 拡大・縮小直後のDOM再描画前（Paint前）に、ターゲットページの画面上位置を即座に復元（アンカースクロール）
  useLayoutEffect(() => {
    if (viewMode !== 'continuous' || !zoomAnchorRef.current || !containerRef.current) {
      return;
    }

    const { pageNum, relativeTop } = zoomAnchorRef.current;
    const targetEl = pageRefs.current.get(pageNum);
    const container = containerRef.current;

    if (targetEl && container) {
      const newRelativeTop = targetEl.getBoundingClientRect().top - container.getBoundingClientRect().top;
      const diff = newRelativeTop - relativeTop;
      if (Math.abs(diff) >= 0.5) {
        container.scrollTop += diff;
      }
    }

    zoomAnchorRef.current = null;
  }, [scale, viewMode]);

  // ズーム操作中フラグのトリガー（一定時間ページ番号更新を完全ロック）
  const triggerZoomingLock = useCallback(() => {
    isZoomingRef.current = true;
    if (isZoomingTimeoutRef.current) {
      clearTimeout(isZoomingTimeoutRef.current);
    }
    isZoomingTimeoutRef.current = setTimeout(() => {
      isZoomingRef.current = false;
    }, 600);
  }, []);

  // ズームイン
  const handleZoomIn = useCallback(() => {
    captureZoomAnchor();
    triggerZoomingLock();
    setScale((prev) => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100));
  }, [captureZoomAnchor, triggerZoomingLock]);

  // ズームアウト
  const handleZoomOut = useCallback(() => {
    captureZoomAnchor();
    triggerZoomingLock();
    setScale((prev) => Math.max(0.4, Math.round((prev - 0.15) * 100) / 100));
  }, [captureZoomAnchor, triggerZoomingLock]);

  // ズームリセット（100%）
  const handleResetZoom = useCallback(() => {
    captureZoomAnchor();
    triggerZoomingLock();
    setScale(1.0);
  }, [captureZoomAnchor, triggerZoomingLock]);

  // キーボードショートカット操作およびCtrlキー状態追跡
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        isCtrlPressedRef.current = true;
      }

      // 入力フォーム等ではショートカット無効化
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        isCtrlPressedRef.current = false;
      }
    };

    const handleBlur = () => {
      isCtrlPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      isCtrlPressedRef.current = false;
    };
  }, [isOpen, onClose, handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut]);

  // Ctrl + マウスホイールスクロールによるズーム
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || isCtrlPressedRef.current) {
        // Ctrlキーが押されている間はブラウザの縦スクロール（ページ送り）を完全に抑止
        e.preventDefault();
        e.stopPropagation();

        // ズーム直前の画面上見えているページの位置を記録
        captureZoomAnchor();

        // ズーム中フラグをセット（ズームによる高さ変動に伴うスクロールイベントでのページ誤判定を防止）
        triggerZoomingLock();

        const step = 0.1;
        if (e.deltaY < 0) {
          setScale((prev) => Math.min(2.5, Math.round((prev + step) * 100) / 100));
        } else if (e.deltaY > 0) {
          setScale((prev) => Math.max(0.4, Math.round((prev - step) * 100) / 100));
        }
      }
    };

    // グローバルでもCtrl+ホイールを捕捉し、モーダル外枠などでのスクロール漏れを抑止
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || isCtrlPressedRef.current) {
        e.preventDefault();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('wheel', handleGlobalWheel);
      if (isZoomingTimeoutRef.current) {
        clearTimeout(isZoomingTimeoutRef.current);
      }
    };
  }, [isOpen, captureZoomAnchor, triggerZoomingLock]);

  // 連続スクロールモード時の現在ページ検出
  const handleScroll = useCallback(() => {
    if (viewMode !== 'continuous' || !containerRef.current) return;

    // Ctrlキー押下中またはズーム操作直後は、ページ送り（currentPageの更新）を行わない
    if (isCtrlPressedRef.current || isZoomingRef.current) {
      return;
    }

    const containerTop = containerRef.current.getBoundingClientRect().top;
    let closestPage = 1;
    let minDistance = Infinity;

    pageRefs.current.forEach((el, pageNum) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop - 40);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = pageNum;
        }
      }
    });

    setCurrentPage(closestPage);
  }, [viewMode]);

  // 単一ページ切り替え時にページ上部へスクロール
  useEffect(() => {
    if (viewMode === 'single' && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, viewMode]);

  // 表示モード切り替え時
  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'continuous' && containerRef.current) {
      // 選択中ページへスクロール
      setTimeout(() => {
        const targetEl = pageRefs.current.get(currentPage);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  // プレビュー表示エリア全体のクリックでページング（単一ページ表示時）
  const handlePreviewAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (viewMode !== 'single' || numPages <= 1) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftHalf = clickX < rect.width / 2;

    if (isLeftHalf) {
      if (currentPage > 1) {
        handlePrevPage();
      }
    } else {
      if (currentPage < numPages) {
        handleNextPage();
      }
    }
  }, [viewMode, numPages, currentPage, handlePrevPage, handleNextPage]);

  if (!isOpen) return null;

  const currentScaledWidth = Math.round(BASE_PAGE_WIDTH * scale);

  return (
    <div
      className="pdf-preview-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-title"
    >
      <div className="pdf-preview-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* モーダルヘッダー */}
        <div className="pdf-preview-modal-header">
          <div className="pdf-preview-header-left">
            <FileText className="pdf-preview-header-icon" size={22} />
            <div>
              <h2 id="pdf-preview-title">PDFプレビュー</h2>
              <span className="pdf-preview-page-badge">
                {numPages > 0 ? `${currentPage} / ${numPages} ページ` : '読み込み中...'}
              </span>
            </div>
          </div>

          {/* ツールバー */}
          <div className="pdf-preview-toolbar">
            {/* 表示モード切り替え */}
            <div className="preview-toolbar-group preview-mode-switch">
              <button
                type="button"
                className={`preview-tool-btn ${viewMode === 'single' ? 'active' : ''}`}
                onClick={() => toggleViewMode('single')}
                title="単一ページ表示"
                aria-label="単一ページ表示"
              >
                <Maximize2 size={16} />
                <span className="btn-label-desktop">1ページ</span>
              </button>
              <button
                type="button"
                className={`preview-tool-btn ${viewMode === 'continuous' ? 'active' : ''}`}
                onClick={() => toggleViewMode('continuous')}
                title="全ページ連続スクロール"
                aria-label="全ページ連続スクロール"
              >
                <Layers size={16} />
                <span className="btn-label-desktop">連続表示</span>
              </button>
            </div>

            {/* ページナビゲーション（単一・連続スクロールどちらでも表示） */}
            {numPages > 0 && (
              <div className="preview-toolbar-group page-navigator">
                <button
                  type="button"
                  className="preview-tool-btn icon-only"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  title="前のページ (←)"
                  aria-label="前のページ"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="page-indicator">
                  <strong>{currentPage}</strong> / {numPages}
                </span>
                <button
                  type="button"
                  className="preview-tool-btn icon-only"
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  title="次のページ (→)"
                  aria-label="次のページ"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* ズーム操作 */}
            <div className="preview-toolbar-group zoom-controls">
              <button
                type="button"
                className="preview-tool-btn icon-only"
                onClick={handleZoomOut}
                disabled={scale <= 0.4}
                title="縮小 (-)"
                aria-label="縮小"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                className="preview-tool-btn text-btn"
                onClick={handleResetZoom}
                title="ズームを100%にリセット"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                className="preview-tool-btn icon-only"
                onClick={handleZoomIn}
                disabled={scale >= 2.5}
                title="拡大 (+)"
                aria-label="拡大"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          <div className="pdf-preview-header-right">
            <button
              type="button"
              className="btn btn--primary btn--icon-flex preview-header-save-btn"
              onClick={onDownload}
              disabled={isDownloading || isLoading}
              title="作成されたPDFをダウンロード保存"
            >
              <Download size={16} />
              <span>{isDownloading ? '保存中...' : 'PDFを保存'}</span>
            </button>
            <button className="pdf-preview-close-btn" onClick={onClose} aria-label="プレビューを閉じる">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* プレビュー表示エリア */}
        <div
          ref={containerRef}
          className={`pdf-preview-body ${viewMode}`}
          onScroll={handleScroll}
          onClick={handlePreviewAreaClick}
        >
          {isLoading && (
            <div className="preview-loading-state">
              <Loader2 className="spinner" size={40} />
              <p>プレビュー用PDFを展開中... ({loadingProgress}%)</p>
              <div className="preview-progress-track">
                <div className="preview-progress-fill" style={{ width: `${loadingProgress}%` }} />
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="preview-error-state">
              <p className="error-title">プレビューの生成に失敗しました</p>
              <p className="error-message">{error}</p>
            </div>
          )}

          {!isLoading && !error && renderedPages.length > 0 && (
            <div className="preview-pages-wrapper">
              {viewMode === 'single' ? (
                // 単一ページ表示（エリア全体の左右クリックでページング可能）
                (() => {
                  const page = renderedPages[currentPage - 1];
                  if (!page) return null;
                  const isZoomed = scale !== 1.0;
                  return (
                    <div className={`preview-page-card single-card ${isZoomed ? 'is-zoomed' : ''}`}>
                      <div
                        className={`preview-canvas-container single-page-container ${isZoomed ? 'is-zoomed' : ''}`}
                        style={isZoomed ? { width: `${currentScaledWidth}px` } : undefined}
                      >
                        <img
                          src={page.dataUrl}
                          alt={`PDFページ ${page.pageNumber}`}
                          className="preview-page-img"
                        />
                      </div>
                    </div>
                  );
                })()
              ) : (
                // 全ページ連続スクロール表示（DOM幅ベースでスケーリングし、下部隙間を根治）
                <div className="continuous-pages-list" style={{ width: `${currentScaledWidth}px` }}>
                  {renderedPages.map((page) => (
                    <div
                      key={page.pageNumber}
                      ref={(el) => {
                        if (el) pageRefs.current.set(page.pageNumber, el);
                        else pageRefs.current.delete(page.pageNumber);
                      }}
                      className={`preview-page-card ${currentPage === page.pageNumber ? 'current' : ''}`}
                    >
                      <div className="preview-canvas-container">
                        <img
                          src={page.dataUrl}
                          alt={`PDFページ ${page.pageNumber}`}
                          className="preview-page-img"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
