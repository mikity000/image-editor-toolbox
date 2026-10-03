import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Image as ImageIcon, Undo2, Redo2, Square, Circle, Pentagon, Pencil, Check, Edit3, Trash2, RotateCcw, Download, FolderPlus, Upload, SlidersHorizontal } from 'lucide-react';

import { Canvas } from 'fabric';
import { useCropperInteraction } from '../hooks/useCropperInteraction';
import { useImageCrop } from '../hooks/useImageCrop';
import { useImageUpload } from '../hooks/useImageUpload';
import { useGallery } from '../../gallery/context/GalleryContext';
import { useToast } from '../../../shared/context/ToastContext';
import SidebarTray from '../../gallery/components/SidebarTray';
import { getSequentialName } from '../../../shared/utils/imageUtils';
import { CROP_CONFIG } from '../../../shared/constants/Constants';
import { GalleryImage } from '../../gallery/types/gallery';
import { CropShapeData } from '../types/crop';
import { convertToWebP } from '../../../shared/utils/webpConverter';
import { saveAs } from 'file-saver';

export default function CropperComponent() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'canvas' | 'result' | 'gallery'>('canvas');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [pathSmoothing, setPathSmoothing] = useState<number>(CROP_CONFIG.PATH_SMOOTHING_DEFAULT);
  const [invertCrop, setInvertCrop] = useState<boolean>(false);
  const [exportBoundsCanvas, setExportBoundsCanvas] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState<number | undefined>(undefined);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const { toast } = useToast();

  const { galleryImages, addImages, removeImage, renameImage, isGalleryOpen, setIsGalleryOpen } = useGallery();
  const { imageLoaded, uploadImage, loadImageFromUrl, imageName, setImageName } = useImageUpload(fabricCanvasRef, setCroppedImageUrl);

  const galleryItems = useMemo(() => {
    return galleryImages.map(img => ({
      id: img.id,
      name: img.name,
      dataUrl: img.dataUrl,
      rawItem: img
    }));
  }, [galleryImages]);

  const {
    drawingObject, isDrawingPolygon, autoCropCount, activeVertices,
    isMagneticMode, setIsMagneticMode, magneticThreshold, setMagneticThreshold,
    startCropping, finishPolygonDrawing, editPolygonVertices, adjustCroppingShape, adjustActiveVertex, deleteActiveVertex, deleteActiveShape, getTempPolygon, selectVertexAtPosition, reset,
    undo, redo, canUndo, canRedo
  } = useCropperInteraction(fabricCanvasRef, imageLoaded, setCroppedImageUrl, pathSmoothing);

  const { crop } = useImageCrop(fabricCanvasRef, setCroppedImageUrl, invertCrop, setExportBoundsCanvas);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const userAgentData = (navigator as any).userAgentData;
      const isMac = /Mac/i.test(userAgentData?.platform || navigator.userAgent || '');
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            e.preventDefault();
            if (canRedo) redo();
          } else {
            e.preventDefault();
            if (canUndo) undo();
          }
        } else if (e.key.toLowerCase() === 'y' && !isMac) {
          e.preventDefault();
          if (canRedo) redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  const handleCroppedImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isDrawingPolygon) return;

    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    if (exportBoundsCanvas) {
      const canvasX = exportBoundsCanvas.left + xRatio * exportBoundsCanvas.width;
      const canvasY = exportBoundsCanvas.top + yRatio * exportBoundsCanvas.height;
      
      selectVertexAtPosition(canvasX, canvasY);
    }
  }, [isDrawingPolygon, exportBoundsCanvas, selectVertexAtPosition]);

  const handleSaveToGallery = useCallback(() => {
    if (!croppedImageUrl) return;
    const newName = getSequentialName(imageName, galleryImages);
    addImages({ name: newName, dataUrl: croppedImageUrl });
  }, [croppedImageUrl, imageName, galleryImages, addImages]);

  const handleDownload = useCallback(async () => {
    if (!croppedImageUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const webpDataUrl = await convertToWebP(croppedImageUrl);
      const downloadName = imageName
        ? `${imageName.replace(/\.[^/.]+$/, '')}_cropped.webp`
        : 'cropped_image.webp';

      const res = await fetch(webpDataUrl);
      const blob = await res.blob();
      saveAs(blob, downloadName);
    } catch (err) {
      console.error('WebP変換・ダウンロードに失敗しました:', err);
      toast.error('画像のダウンロードに失敗しました。');
    } finally {
      setIsDownloading(false);
    }
  }, [croppedImageUrl, imageName, isDownloading, toast]);

  const handleGalleryItemClick = useCallback((img: GalleryImage) => {
    setImageName(img.name);
    loadImageFromUrl(img.dataUrl);
    setMobileTab('canvas');
  }, [setImageName, loadImageFromUrl]);

  useEffect(() => {
    if (autoCropCount > 0) {
      if (isDrawingPolygon) {
        const tempPoly = getTempPolygon();
        if (tempPoly) {
          crop(tempPoly);
        } else {
          crop();
        }
      } else {
        crop();
      }
    }
  }, [autoCropCount, isDrawingPolygon, crop, getTempPolygon]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const wrapperEl = canvasRef.current.parentElement;
    if (!wrapperEl) return;

    const canvas = new Canvas(canvasRef.current, {
      selection: false,
      hoverCursor: 'default',
      width: wrapperEl.clientWidth,
      height: wrapperEl.clientHeight,
    });
    fabricCanvasRef.current = canvas;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          canvas.setDimensions({ width, height });
          canvas.requestRenderAll();
        }
      }
    });
    resizeObserver.observe(wrapperEl);

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  const {
    MAGNETIC_THRESHOLD_MIN,
    MAGNETIC_THRESHOLD_MAX,
    PATH_SMOOTHING_MIN,
    PATH_SMOOTHING_MAX,
  } = CROP_CONFIG;

  return (
    <div className={`editor-container cropper-container mobile-view-${mobileTab}`}>
      {/* モバイル専用セグメントタブバー */}
      <div className="mobile-cropper-tabs" role="tablist" aria-label="表示切り替え">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'canvas'}
          className={`mobile-cropper-tab ${mobileTab === 'canvas' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('canvas')}
        >
          <span>編集</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'result'}
          className={`mobile-cropper-tab ${mobileTab === 'result' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('result')}
        >
          <span>結果</span>
          {croppedImageUrl && <span className="mobile-tab-badge" />}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'gallery'}
          className={`mobile-cropper-tab ${mobileTab === 'gallery' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('gallery')}
        >
          <span>ギャラリー</span>
          {galleryItems.length > 0 && <span className="mobile-tab-count">({galleryItems.length})</span>}
        </button>
      </div>

      <div className="editor-layout">
        <div className="editor-left-sidebar">
          <SidebarTray
            title="共有ギャラリー"
            trayType="gallery"
            isOpen={isGalleryOpen}
            onToggle={() => setIsGalleryOpen(!isGalleryOpen)}
            emptyMessage={<>ギャラリーは空です。<br />[共有ギャラリーに保存]ボタンを押下して画像を追加してください。</>}
            items={galleryItems}
            onClickItem={handleGalleryItemClick}
            onDeleteItems={removeImage}
            onRenameItem={renameImage}
            actionText="編集する"
          />
        </div>
        <div className="editor-main">
          <div className="cropper-workspace">
            <div className="canvas-wrapper-container">
              {!imageLoaded && (
                <div className="empty-placeholder-wrapper cropper-empty-overlay">
                  <div className="empty-placeholder-card">
                    <Upload size={48} className="empty-placeholder-icon" />
                    <h3>クロップする画像を読み込んでください</h3>
                    <p>JPEG / PNG / WebP などの画像ファイルに対応しています。</p>
                    <label className="btn btn--primary btn--icon-flex empty-placeholder-upload-btn">
                      <Upload size={18} />
                      画像を選択
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }}
                        onClick={e => { (e.target as HTMLInputElement).value = ''; }} 
                        onChange={uploadImage} 
                      />
                    </label>
                  </div>
                </div>
              )}
              <div className="canvas-wrapper" style={{ display: imageLoaded ? 'block' : 'none' }}>
                <canvas ref={canvasRef} />

                {/* モバイル用多角形描画バー */}
                {isDrawingPolygon && !drawingObject && (
                  <div className="mobile-cropper-polygon-bar">
                    <button 
                      type="button"
                      onClick={() => setIsMagneticMode(!isMagneticMode)} 
                      className={`btn btn--sm ${isMagneticMode ? 'btn--primary' : ''}`}
                    >
                      吸着 {isMagneticMode ? 'ON' : 'OFF'}
                    </button>
                    <button 
                      type="button"
                      onClick={finishPolygonDrawing} 
                      className="btn btn--warning btn--sm btn--icon-flex"
                    >
                      <Check size={16} />描画完了
                    </button>
                  </div>
                )}
              </div>

              {/* モバイル用クイックシェイプバー＆折りたたみサブバー */}
              <div className="mobile-cropper-quickbar-container">
                <div className="mobile-cropper-quickbar">
                  <label className="btn quick-btn quick-upload-label" title="画像を選択">
                    <Upload size={18} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onClick={e => { (e.target as HTMLInputElement).value = ''; }} 
                      onChange={uploadImage} 
                    />
                  </label>
                  <div className="quickbar-divider" />
                  <button 
                    type="button"
                    onClick={() => startCropping('rect')} 
                    className={`btn quick-btn ${drawingObject && (drawingObject as CropShapeData).type === 'rect' ? 'is-selected' : ''}`} 
                    disabled={!imageLoaded} 
                    aria-label="矩形"
                    title="矩形クロップ"
                  >
                    <Square size={20} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => startCropping('circle')} 
                    className={`btn quick-btn ${drawingObject && (drawingObject as CropShapeData).type === 'circle' ? 'is-selected' : ''}`} 
                    disabled={!imageLoaded} 
                    aria-label="円形"
                    title="円形クロップ"
                  >
                    <Circle size={20} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => startCropping('polygon')} 
                    className={`btn quick-btn ${drawingObject && (drawingObject as CropShapeData).type === 'polygon' ? 'is-selected' : ''}`} 
                    disabled={!imageLoaded} 
                    aria-label="多角形"
                    title="多角形クロップ"
                  >
                    <Pentagon size={20} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => startCropping('path')} 
                    className={`btn quick-btn ${drawingObject && (drawingObject as CropShapeData).type === 'path' ? 'is-selected' : ''}`} 
                    disabled={!imageLoaded} 
                    aria-label="フリーハンド"
                    title="フリーハンドクロップ"
                  >
                    <Pencil size={20} />
                  </button>
                  <div className="quickbar-divider" />
                  <button 
                    type="button"
                    onClick={undo} 
                    disabled={!canUndo} 
                    className="btn quick-btn" 
                    aria-label="元に戻す"
                    title="元に戻す"
                  >
                    <Undo2 size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={redo} 
                    disabled={!canRedo} 
                    className="btn quick-btn" 
                    aria-label="やり直す"
                    title="やり直す"
                  >
                    <Redo2 size={18} />
                  </button>
                  {drawingObject && (
                    <button
                      type="button"
                      onClick={deleteActiveShape}
                      className="btn quick-btn btn--danger"
                      title="選択中の図形を削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <div className="quickbar-divider" />
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className={`btn quick-btn ${isMoreMenuOpen ? 'is-selected' : ''}`}
                    title="操作・詳細設定の展開"
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>

                {/* 2行目折りたたみサブバー */}
                {isMoreMenuOpen && (
                  <div className="mobile-cropper-subbar">
                    <button
                      type="button"
                      onClick={() => setInvertCrop(!invertCrop)}
                      className={`btn btn--sm ${invertCrop ? 'btn--primary' : 'btn--secondary'}`}
                    >
                      外側切り取り: {invertCrop ? 'ON' : 'OFF'}
                    </button>
                    {drawingObject && (drawingObject as CropShapeData).type === 'polygon' && (
                      <button
                        type="button"
                        onClick={editPolygonVertices}
                        className="btn btn--sm btn--warning btn--icon-flex"
                      >
                        <Edit3 size={15} /> 頂点編集
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={reset}
                      className="btn btn--sm btn--danger btn--icon-flex"
                    >
                      <RotateCcw size={15} /> リセット
                    </button>
                    {croppedImageUrl && (
                      <>
                        <button
                          type="button"
                          onClick={handleDownload}
                          disabled={isDownloading}
                          className="btn btn--sm btn--primary btn--icon-flex"
                        >
                          <Download size={15} /> 保存
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveToGallery}
                          className="btn btn--sm btn--success btn--icon-flex"
                        >
                          <FolderPlus size={15} /> ギャラリー
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="result-container-wrapper">
              <div className="result-container">
                {croppedImageUrl ? (
                  <div className="result-image-wrapper">
                    <div className="result-image-box" style={{ aspectRatio: cropAspectRatio }}>
                      <img 
                        src={croppedImageUrl} 
                        alt="Cropped Result" 
                        id="croppedResult" 
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth && img.naturalHeight) {
                            setCropAspectRatio(img.naturalWidth / img.naturalHeight);
                          }
                        }}
                        onClick={handleCroppedImageClick}
                        className="result-image"
                      />
                      {isDrawingPolygon && activeVertices && activeVertices.length > 0 && exportBoundsCanvas && (
                        activeVertices.map((vertex, idx) => (
                          <div key={idx} className="vertex-marker" style={{
                            left: `${((vertex.x - exportBoundsCanvas.left) / exportBoundsCanvas.width) * 100}%`,
                            top: `${((vertex.y - exportBoundsCanvas.top) / exportBoundsCanvas.height) * 100}%`,
                          }} />
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="result-placeholder">
                    <ImageIcon size={134} strokeWidth={1.5} />
                    <p>ここにクロップ結果が表示されます</p>
                  </div>
                )}
                {croppedImageUrl && (
                  <div className="mobile-result-actions">
                    <button 
                      type="button"
                      onClick={handleDownload} 
                      disabled={isDownloading}
                      className="btn btn--primary btn--icon-flex"
                    >
                      <Download size={18} />
                      {isDownloading ? '保存中...' : 'WebPダウンロード'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleSaveToGallery} 
                      className="btn btn--success btn--icon-flex"
                    >
                      <FolderPlus size={18} />ギャラリー保存
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="editor-sidebar">
          <div className="sidebar-sticky-content">
            <div className="file-input">
              <input 
                type="file" 
                accept="image/*" 
                className="file-input__control" 
                onClick={e => { (e.target as HTMLInputElement).value = ''; }} 
                onChange={uploadImage} 
              />
            </div>

            <div className="setting-box">
              <input 
                type="checkbox" 
                id="invertCropCheckbox"
                checked={invertCrop} 
                onChange={(e) => setInvertCrop(e.target.checked)}
                className="custom-checkbox"
              />
              <label htmlFor="invertCropCheckbox" className="custom-checkbox-label">外側を切り取る</label>
            </div>

            <div className="button-group sidebar-buttons">
              <div className="undo-redo-wrapper">
                <button onClick={undo} disabled={!canUndo} className="btn btn-undo-redo" aria-label="元に戻す">
                  <Undo2 size={18} />
                </button>
                <button onClick={redo} disabled={!canRedo} className="btn btn-undo-redo" aria-label="やり直す">
                  <Redo2 size={18} />
                </button>
              </div>

              <button onClick={() => startCropping('rect')} className="btn shape-btn" disabled={!imageLoaded} aria-label="矩形クロップ">
                <Square size={28} />
              </button>
              <button onClick={() => startCropping('circle')} className="btn shape-btn" disabled={!imageLoaded} aria-label="円形クロップ">
                <Circle size={28} />
              </button>
              <button onClick={() => startCropping('polygon')} className="btn shape-btn" disabled={!imageLoaded} aria-label="多角形クロップ">
                <Pentagon size={28} />
              </button>
              <button onClick={() => startCropping('path')} className="btn shape-btn" disabled={!imageLoaded} aria-label="フリーハンドクロップ">
                <Pencil size={28} />
              </button>
              
              {isDrawingPolygon && !drawingObject && (
                <>
                  <div className="setting-box slider-group--block mb-8 grid-col-full">
                    <label htmlFor="magneticModeCheckbox" className={`custom-checkbox-label custom-checkbox-label--flex custom-checkbox-label--full ${isMagneticMode ? 'mb-8' : 'mb-0'}`}>
                      <input type="checkbox" id="magneticModeCheckbox" checked={isMagneticMode} onChange={(e) => setIsMagneticMode(e.target.checked)} className="custom-checkbox" />
                      吸着モード {isMagneticMode && <span className="sensitivity-label">感度: {magneticThreshold}</span>}
                    </label>
                    {isMagneticMode && (
                      <div className="slider-wrapper">
                        <input 
                          type="range" 
                          min={MAGNETIC_THRESHOLD_MIN} 
                          max={MAGNETIC_THRESHOLD_MAX} 
                          value={magneticThreshold}
                          onChange={e => setMagneticThreshold(parseInt(e.target.value, 10))}
                          className="range-full"
                          style={{ '--thumb-percent': `${((magneticThreshold - MAGNETIC_THRESHOLD_MIN) / (MAGNETIC_THRESHOLD_MAX - MAGNETIC_THRESHOLD_MIN)) * 100}%` } as React.CSSProperties}
                        />
                      </div>
                    )}
                  </div>
                  <button onClick={finishPolygonDrawing} className="btn btn--warning btn-full btn--icon-flex grid-col-full">
                    <Check size={18} />描画完了
                  </button>
                </>
              )}
              
              {drawingObject && (drawingObject as CropShapeData).type === 'polygon' && (
                <button onClick={editPolygonVertices} className="btn btn--warning btn-full btn--icon-flex">
                  <Edit3 size={18} />頂点を再編集
                </button>
              )}
              {drawingObject && (
                <button onClick={deleteActiveShape} className="btn btn--danger btn-full btn--icon-flex">
                  <Trash2 size={18} />削除
                </button>
              )}
              <button onClick={reset} className="btn btn--danger btn-full btn--icon-flex">
                <RotateCcw size={18} />リセット
              </button>

              {croppedImageUrl && (
                <>
                  <button 
                    onClick={handleDownload} 
                    disabled={isDownloading}
                    className="btn btn--primary btn-full btn--icon-flex"
                  >
                    <Download size={18} />
                    {isDownloading ? 'WebP変換中...' : 'ダウンロード'}
                  </button>
                  <button 
                    onClick={handleSaveToGallery} 
                    className="btn btn--success btn-full btn--icon-flex"
                  >
                    <FolderPlus size={18} />共有ギャラリーに保存
                  </button>
                </>
              )}
            </div>

            {drawingObject && (drawingObject as CropShapeData).type === 'path' && (
              <div className="slider-group">
                <label>曲線の滑らかさ補正</label>
                <input 
                  type="range" 
                  min={PATH_SMOOTHING_MIN} 
                  max={PATH_SMOOTHING_MAX} 
                  value={pathSmoothing}
                  onChange={e => setPathSmoothing(parseInt(e.target.value, 10))}
                  style={{ '--thumb-percent': `${((pathSmoothing - PATH_SMOOTHING_MIN) / (PATH_SMOOTHING_MAX - PATH_SMOOTHING_MIN)) * 100}%` } as React.CSSProperties}
                />
                <span className="slider-group__value">{pathSmoothing}</span>
              </div>
            )}

            {drawingObject && (drawingObject as CropShapeData).type !== 'polygon' && (drawingObject as CropShapeData).type !== 'path' && (
              <div className="adjustment-controls">
                <h3>選択中の図形の調整</h3>
                <div className="adjustment-group">
                  {(['top', 'right', 'left', 'bottom'] as const).map((side) => (
                    <div key={side} className="adjustment-box">
                      <h4>{{ 'top': '上辺', 'right': '右辺', 'left': '左辺', 'bottom': '下辺' }[side]}</h4>
                      <div className="adjustment-buttons">
                        <button onClick={() => adjustCroppingShape(side, -0.5)} className="btn">-</button>
                        <button onClick={() => adjustCroppingShape(side, 0.5)} className="btn">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isDrawingPolygon && !drawingObject && (
              <div className="adjustment-controls">
                <h3>選択中の頂点の操作</h3>
                <div className="adjustment-group">
                  <div className="adjustment-box">
                    <h4>X軸 (左右)</h4>
                    <div className="adjustment-buttons">
                      <button onClick={() => adjustActiveVertex(-0.5, 0)} className="btn">←</button>
                      <button onClick={() => adjustActiveVertex(0.5, 0)} className="btn">→</button>
                    </div>
                  </div>
                  <div className="adjustment-box">
                    <h4>Y軸 (上下)</h4>
                    <div className="adjustment-buttons">
                      <button onClick={() => adjustActiveVertex(0, -0.5)} className="btn">↑</button>
                      <button onClick={() => adjustActiveVertex(0, 0.5)} className="btn">↓</button>
                    </div>
                  </div>
                  <div className="adjustment-box grid-col-full">
                    <h4>削除</h4>
                    <button onClick={deleteActiveVertex} className="btn btn--danger btn--auto-width btn-full btn--icon-flex">
                      <Trash2 size={18} />頂点を削除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
