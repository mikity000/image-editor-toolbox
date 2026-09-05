import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Pencil,
  Highlighter,
  Eraser,
  PaintBucket,
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  Download,
  FileText,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Pipette,
} from 'lucide-react';
import { usePaintCanvas } from '../hooks/usePaintCanvas';
import { useGallery } from '../context/GalleryContext';
import SidebarTray from './SidebarTray';
import { PAINT_CONFIG } from '../constants/Constants';
import { getSequentialName } from '../utils/imageUtils';
import { PaintToolType, EraserMode } from '../types/paint';
import { GalleryImage } from '../types/gallery';
import { TrayItemData } from '../types/ui';

interface PaintToolDef {
  id: PaintToolType;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
}

// 描画ツール定義
const TOOLS: PaintToolDef[] = [
  { id: 'pen', label: 'ペン', icon: Pencil, title: '通常ペン' },
  { id: 'highlighter', label: '蛍光ペン', icon: Highlighter, title: '蛍光ペン' },
  { id: 'eraser', label: '消しゴム', icon: Eraser, title: '消しゴム' },
  { id: 'bucket', label: 'バケツ', icon: PaintBucket, title: 'バケツ塗りつぶし (手書き線・閉曲線)' },
  { id: 'smart_fill', label: 'スマート', icon: Sparkles, title: 'スマート塗りつぶし (AI・輪郭自動認識)' },
];

interface EraserModeDef {
  id: EraserMode;
  label: string;
}

// 消しゴムモード定義
const ERASER_MODES: EraserModeDef[] = [
  { id: 'pixel', label: 'ピクセル消去' },
  { id: 'stroke', label: 'ストローク消去' },
];

export default function PaintComponent() {
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const {
    containerRef,
    bgCanvasRef,
    paintCanvasRef,
    mediaType,
    fileName,
    totalPages,
    currentPage,
    isLoading,
    loadingText,
    canvasDimensions,
    activeTool,
    setActiveTool,
    eraserMode,
    setEraserMode,
    color,
    setColor,
    brushSize,
    setBrushSize,
    tolerance,
    setTolerance,
    fillOpacity,
    setFillOpacity,
    gapClosing,
    setGapClosing,
    canUndo,
    canRedo,
    zoom,
    pan,
    isAltPressed,
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoomPan,
    loadFile,
    loadImageFromDataUrl,
    changePage,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    undo,
    redo,
    clearCurrentCanvas,
    getCurrentMergedDataUrl,
    exportAsImage,
    exportAsPdf,
  } = usePaintCanvas();

  const { galleryImages, addImages, removeImage, renameImage, isGalleryOpen, setIsGalleryOpen } = useGallery();

  // カラーパレットポップオーバーの外側クリック検知
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setIsPaletteOpen(false);
      }
    };
    if (isPaletteOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPaletteOpen]);

  const [containerAspect, setContainerAspect] = useState<number>(1);

  // コンテナのアスペクト比監視 (横長・縦長画像の隙間ゼロ・完全フィット用)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateAspect = () => {
      if (container.clientWidth && container.clientHeight) {
        setContainerAspect(container.clientWidth / container.clientHeight);
      }
    };

    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mediaType, containerRef]);

  // 画像がコンテナより横長なら左右隙間ゼロ (width: 100%)、縦長なら上下隙間ゼロ (height: 100%)
  const imgAspect = canvasDimensions.width / (canvasDimensions.height || 1);
  const isWiderThanContainer = imgAspect >= containerAspect;

  const galleryItems: TrayItemData[] = useMemo(() => {
    return galleryImages.map((img) => ({
      id: img.id,
      name: img.name,
      dataUrl: img.dataUrl,
      rawItem: img,
    }));
  }, [galleryImages]);

  // ファイル選択ハンドラ
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        loadFile(file);
      }
      e.target.value = '';
    },
    [loadFile]
  );

  // ギャラリーからの画像追加
  const handleGalleryItemClick = useCallback(
    (img: GalleryImage) => {
      loadImageFromDataUrl(img.dataUrl, img.name);
    },
    [loadImageFromDataUrl]
  );

  const [isCursorHovering, setIsCursorHovering] = useState<boolean>(false);
  const [cursorDiameter, setCursorDiameter] = useState<number>(brushSize);
  const cursorPreviewRef = useRef<HTMLDivElement | null>(null);

  // ブラシプレビュー表示対象ツール判定 (ペン、蛍光ペン、ピクセル消しゴム)
  const showBrushCursor = Boolean(
    mediaType &&
    !isAltPressed &&
    (activeTool === 'pen' || activeTool === 'highlighter' || (activeTool === 'eraser' && eraserMode === 'pixel'))
  );

  // キャンバス解像度と表示サイズの比率から正確なプレビュー直径を計算
  useEffect(() => {
    if (!paintCanvasRef.current || !canvasDimensions.width) return;
    const updateDiameter = () => {
      const canvas = paintCanvasRef.current;
      if (!canvas) return;
      const ratio = canvas.clientWidth / canvasDimensions.width;
      setCursorDiameter(Math.max(brushSize * ratio, 2));
    };

    updateDiameter();
    const resizeObserver = new ResizeObserver(updateDiameter);
    resizeObserver.observe(paintCanvasRef.current);
    return () => resizeObserver.disconnect();
  }, [brushSize, canvasDimensions.width, paintCanvasRef]);

  // カーソル位置の直接DOM更新 (高速・滑らかな追従)
  const updateCursorPosition = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cursorPreviewRef.current || !paintCanvasRef.current) return;
    const canvas = paintCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // ステージ内ローカルCSS座標系 (0 〜 canvas.clientWidth, 0 〜 canvas.clientHeight)
    const localX = (e.clientX - rect.left) / (rect.width / (canvas.clientWidth || 1));
    const localY = (e.clientY - rect.top) / (rect.height / (canvas.clientHeight || 1));

    cursorPreviewRef.current.style.left = `${localX}px`;
    cursorPreviewRef.current.style.top = `${localY}px`;
  }, [paintCanvasRef]);

  // ポインターイベントハンドラー (プレビュー追従と既存操作の連携)
  const onCanvasPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      setIsCursorHovering(true);
      updateCursorPosition(e);
    },
    [updateCursorPosition]
  );

  const onCanvasPointerLeave = useCallback(() => {
    setIsCursorHovering(false);
  }, []);

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isCursorHovering) {
        setIsCursorHovering(true);
      }
      updateCursorPosition(e);
      handlePointerMove(e);
    },
    [isCursorHovering, updateCursorPosition, handlePointerMove]
  );

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      updateCursorPosition(e);
      handlePointerDown(e);
    },
    [updateCursorPosition, handlePointerDown]
  );

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      updateCursorPosition(e);
      handlePointerUp(e);
    },
    [updateCursorPosition, handlePointerUp]
  );

  // プレビューのスタイル
  const cursorPreviewStyle = useMemo((): React.CSSProperties => {
    let bgColor = color;
    let opacity = 0.55;

    if (activeTool === 'highlighter') {
      opacity = PAINT_CONFIG.HIGHLIGHTER_OPACITY;
    } else if (activeTool === 'eraser') {
      bgColor = 'rgba(255, 255, 255, 0.3)';
      opacity = 1;
    }

    return {
      width: `${cursorDiameter}px`,
      height: `${cursorDiameter}px`,
      backgroundColor: bgColor,
      opacity: isCursorHovering ? opacity : 0,
      display: isCursorHovering ? 'block' : 'none',
    };
  }, [activeTool, color, cursorDiameter, isCursorHovering]);

  // 共有ギャラリーへ現在の合成画像を保存
  const handleSaveToGallery = useCallback(async () => {
    if (!mediaType) return;
    try {
      const dataUrl = await getCurrentMergedDataUrl();
      if (dataUrl) {
        const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'paint_image';
        const pageSuffix = totalPages > 1 ? `_p${currentPage}` : '';
        const rawName = `${baseName}${pageSuffix}`;
        const newName = getSequentialName(rawName, galleryImages);
        addImages({ name: `${newName}.webp`, dataUrl });
      }
    } catch (err) {
      console.error('ギャラリーへの保存に失敗しました:', err);
      alert('ギャラリーへの保存に失敗しました。');
    }
  }, [mediaType, fileName, totalPages, currentPage, getCurrentMergedDataUrl, galleryImages, addImages]);

  return (
    <div className="editor-container">
      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <p>{loadingText || '処理中...'}</p>
          </div>
        </div>
      )}

      <div className="editor-layout">
        {/* 左サイドバー: 共有ギャラリー */}
        <div className="editor-left-sidebar">
          <SidebarTray
            title="共有ギャラリー"
            trayType="gallery"
            isOpen={isGalleryOpen}
            onToggle={() => setIsGalleryOpen(!isGalleryOpen)}
            emptyMessage={
              <>
                ギャラリーは空です。
                <br />
                [共有ギャラリーに保存]ボタンを押下して画像を追加してください。
              </>
            }
            items={galleryItems}
            onClickItem={handleGalleryItemClick}
            onDeleteItems={removeImage}
            onRenameItem={renameImage}
            actionText="キャンバスに読み込む"
          />
        </div>

        {/* メイン描画エリア */}
        <div className="editor-main paint-main-content">
            {!mediaType ? (
              <div className="paint-empty-placeholder">
                <div className="paint-empty-card">
                  <Upload size={48} className="paint-empty-icon" />
                  <h3>画像またはPDFファイルを読み込んでください</h3>
                  <p>JPEG / PNG 画像や、複数ページのPDFに対応しています。</p>
                  <label className="btn btn--primary btn--icon-flex paint-upload-btn">
                    <Upload size={18} />
                    ファイルを選択
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleFileInput}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            ) : (
            <div className="paint-canvas-wrapper" ref={containerRef} onWheel={handleWheel}>
                {/* 複数ページPDF ナビゲーションバー */}
                {totalPages > 1 && (
                  <div className="paint-page-bar">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm btn--icon-flex"
                      onClick={() => changePage(currentPage - 1)}
                      disabled={currentPage <= 1 || isLoading}
                    >
                      <ChevronLeft size={16} /> 前へ
                    </button>
                    <span className="paint-page-indicator">
                      {currentPage} / {totalPages} ページ
                    </span>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm btn--icon-flex"
                      onClick={() => changePage(currentPage + 1)}
                      disabled={currentPage >= totalPages || isLoading}
                    >
                      次へ <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {/* 2層Canvas描画領域 */}
                <div
                  className={`paint-canvas-stage ${isAltPressed ? 'is-panning' : ''}`}
                  style={{
                    width: isWiderThanContainer ? '100%' : 'auto',
                    height: isWiderThanContainer ? 'auto' : '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* 背景レイヤー (画像 / PDF) */}
                  <canvas ref={bgCanvasRef} className="paint-canvas-bg" />

                  {/* 描画レイヤー (手書きペイント) */}
                  <canvas
                    ref={paintCanvasRef}
                    className={`paint-canvas-draw tool-${activeTool} ${showBrushCursor ? 'has-brush-cursor' : ''} ${isAltPressed ? 'is-alt-pan' : ''}`}
                    onPointerDown={onCanvasPointerDown}
                    onPointerMove={onCanvasPointerMove}
                    onPointerUp={onCanvasPointerUp}
                    onPointerEnter={onCanvasPointerEnter}
                    onPointerLeave={onCanvasPointerLeave}
                  />

                  {/* ブラシカーソルプレビュー (太さ・色・透明度のリアルタイム表示) */}
                  {showBrushCursor && (
                    <div
                      ref={cursorPreviewRef}
                      className={`paint-cursor-preview tool-${activeTool}`}
                      style={cursorPreviewStyle}
                    >
                      <div className="paint-cursor-dot" />
                    </div>
                  )}
                </div>

                {/* フローティングズーム操作バー */}
                <div className="paint-zoom-bar">
                  <button
                    type="button"
                    className="btn-zoom"
                    onClick={zoomOut}
                    disabled={zoom <= 0.2}
                    title="縮小 (ホイール下スクロール)"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-zoom-value"
                    onClick={resetZoomPan}
                    title="クリックで100%にリセット"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    className="btn-zoom"
                    onClick={zoomIn}
                    disabled={zoom >= 5.0}
                    title="拡大 (ホイール上スクロール)"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-zoom"
                    onClick={resetZoomPan}
                    title="表示位置・倍率リセット"
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* 右サイドバー: ペイントツール設定 */}
        <div className="editor-sidebar paint-sidebar">
          <div className="sidebar-sticky-content">
            {/* ファイル入力セクション */}
            <div className="file-input">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="file-input__control"
                disabled={isLoading}
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = '';
                }}
                onChange={handleFileInput}
              />
            </div>

            {mediaType && (
              <>
                {/* 描画・塗りつぶしツール選択 */}
                <div className="control-group">
                  <label className="control-label">ツール選択</label>
                  <div className="paint-tool-buttons">
                    {TOOLS.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          className={`btn-tool ${activeTool === tool.id ? 'is-active' : ''}`}
                          onClick={() => setActiveTool(tool.id)}
                          title={tool.title}
                        >
                          <Icon size={18} />
                          <span>{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* カラーパレット (消しゴム以外で有効) */}
                {activeTool !== 'eraser' && (
                  <div className="control-group" ref={paletteRef} style={{ position: 'relative' }}>
                    <div className="control-label-row">
                      <label className="control-label">描画色</label>
                      <button
                        type="button"
                        className="paint-current-color-btn"
                        onClick={() => setIsPaletteOpen((prev) => !prev)}
                        title="カラーパレットを開く"
                      >
                        <span className="paint-color-swatch-circle" style={{ backgroundColor: color }} />
                        <span className="paint-color-code">{color.toUpperCase()}</span>
                      </button>
                    </div>

                    {/* ポップオーバー カラーパレット */}
                    {isPaletteOpen && (
                      <div className="paint-palette-popover">
                        <div className="paint-popover-header">
                          <span className="paint-popover-title">パレット（20色）</span>
                          <label className="paint-custom-picker-trigger" title="自由選択カラーピッカー">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => setColor(e.target.value)}
                            />
                            <Pipette size={14} />
                            <span>カスタム色</span>
                          </label>
                        </div>
                        <div className="paint-palette-grid">
                          {PAINT_CONFIG.COLOR_PALETTE.map((item) => (
                            <button
                              key={item.color}
                              type="button"
                              className={`paint-color-swatch ${color.toLowerCase() === item.color.toLowerCase() ? 'is-selected' : ''}`}
                              style={{ backgroundColor: item.color }}
                              onClick={() => {
                                setColor(item.color);
                                setIsPaletteOpen(false);
                              }}
                              title={item.label}
                              aria-label={item.label}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 消しゴムタイプ設定 (消しゴムツール選択時) */}
                {activeTool === 'eraser' && (
                  <div className="control-group">
                    <label className="control-label">消しゴムタイプ</label>
                    <div className="paint-eraser-mode-buttons">
                      {ERASER_MODES.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          className={`btn-eraser-mode ${eraserMode === mode.id ? 'is-active' : ''}`}
                          onClick={() => setEraserMode(mode.id)}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ブラシ太さ設定 (ペン・蛍光ペン・ピクセル消しゴム用) */}
                {(activeTool === 'pen' || activeTool === 'highlighter' || (activeTool === 'eraser' && eraserMode === 'pixel')) && (
                  <div className="control-group">
                    <div className="control-label-row">
                      <label className="control-label">
                        {activeTool === 'eraser' ? '消しゴムの太さ' : '線の太さ'}
                      </label>
                      <span className="control-value">{brushSize} px</span>
                    </div>

                    <input
                      type="range"
                      min={PAINT_CONFIG.MIN_BRUSH_SIZE}
                      max={PAINT_CONFIG.MAX_BRUSH_SIZE}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="slider"
                    />

                    {/* ブラシプレビュー */}
                    <div className="paint-brush-preview-box">
                      <div
                        className="paint-brush-preview-dot"
                        style={{
                          width: `${Math.min(brushSize, 60)}px`,
                          height: `${Math.min(brushSize, 60)}px`,
                          backgroundColor: activeTool === 'eraser' ? '#ffffff' : color,
                          opacity: activeTool === 'highlighter' ? PAINT_CONFIG.HIGHLIGHTER_OPACITY : 1.0,
                          border: activeTool === 'eraser' ? '2px dashed var(--border-color)' : 'none',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 塗りつぶし設定 (バケツ・スマート塗りつぶし用) */}
                {(activeTool === 'bucket' || activeTool === 'smart_fill') && (
                  <div className="control-group">
                    <div className="control-label-row">
                      <label className="control-label">
                        {activeTool === 'smart_fill' ? '輪郭認識感度 (許容度)' : '塗りつぶし許容度'}
                      </label>
                      <span className="control-value">{tolerance}%</span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="slider"
                    />

                    <div className="control-label-row" style={{ marginTop: '12px' }}>
                      <label className="control-label">塗りつぶし不透明度</label>
                      <span className="control-value">{fillOpacity}%</span>
                    </div>

                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={fillOpacity}
                      onChange={(e) => setFillOpacity(Number(e.target.value))}
                      className="slider"
                    />

                    <div className="control-label-row" style={{ marginTop: '12px' }}>
                      <label className="control-label">線の途切れ許容</label>
                      <span className="control-value">{gapClosing}px</span>
                    </div>

                    <input
                      type="range"
                      min={PAINT_CONFIG.MIN_GAP_CLOSING}
                      max={PAINT_CONFIG.MAX_GAP_CLOSING}
                      value={gapClosing}
                      onChange={(e) => setGapClosing(Number(e.target.value))}
                      className="slider"
                      title="線の隙間・開口部があっても外に漏れ出さずに塞いで塗る許容幅"
                    />
                  </div>
                )}

                {/* 操作・履歴ボタン (Undo / Redo / クリア) */}
                <div className="control-group">
                  <label className="control-label">操作・履歴</label>
                  <div className="paint-history-buttons">
                    <button
                      type="button"
                      onClick={undo}
                      disabled={!canUndo || isLoading}
                      className="btn btn--secondary btn--icon-flex"
                      title="1つ戻る (Ctrl+Z)"
                    >
                      <Undo2 size={16} /> 1つ戻る
                    </button>
                    <button
                      type="button"
                      onClick={redo}
                      disabled={!canRedo || isLoading}
                      className="btn btn--secondary btn--icon-flex"
                      title="やり直す (Ctrl+Y)"
                    >
                      <Redo2 size={16} /> やり直す
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={clearCurrentCanvas}
                    disabled={!canUndo || isLoading}
                    className="btn btn--danger btn-full btn--icon-flex"
                    style={{ marginTop: '8px' }}
                  >
                    <Trash2 size={16} /> 描画を全消去
                  </button>
                </div>

                {/* エクスポート・保存ボタン群 */}
                <div className="control-group">
                  <label className="control-label">保存・エクスポート</label>
                  <div className="button-group sidebar-buttons">
                    <button
                      type="button"
                      onClick={exportAsImage}
                      disabled={isLoading}
                      className="btn btn--primary btn-full btn--icon-flex"
                    >
                      <Download size={18} />
                      画像として保存 (WebP)
                    </button>

                    <button
                      type="button"
                      onClick={exportAsPdf}
                      disabled={isLoading}
                      className="btn btn--primary btn-full btn--icon-flex"
                    >
                      <FileText size={18} />
                      {totalPages > 1 ? `全${totalPages}ページをPDF保存` : 'PDFとして保存'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveToGallery}
                      disabled={isLoading}
                      className="btn btn--secondary btn-full btn--icon-flex"
                    >
                      <FolderPlus size={18} />
                      共有ギャラリーに保存
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
