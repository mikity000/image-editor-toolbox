import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Image as ImageIcon, Undo2, Redo2, Square, Circle, Pentagon, Pencil, Check, Edit3, Trash2, RotateCcw, Download, FolderPlus } from 'lucide-react';

import { Canvas } from 'fabric';
import { useCropperInteraction } from '../hooks/useCropperInteraction';
import { useImageCrop } from '../hooks/useImageCrop';
import { useImageUpload } from '../hooks/useImageUpload';
import { useGallery } from '../context/GalleryContext';
import SidebarTray from './SidebarTray';
import { getSequentialName } from '../utils/imageUtils';
import { CROP_CONFIG } from '../constants/Constants';

export default function CropperComponent() {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [pathSmoothing, setPathSmoothing] = useState(CROP_CONFIG.PATH_SMOOTHING_DEFAULT);
  const [invertCrop, setInvertCrop] = useState(false);
  const [exportBoundsCanvas, setExportBoundsCanvas] = useState(null);
  const [cropAspectRatio, setCropAspectRatio] = useState(null);

  
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
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const isMac = /Mac/i.test(navigator.userAgentData?.platform || navigator.userAgent || '');
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

  const handleCroppedImageClick = useCallback((e) => {
    if (!isDrawingPolygon) return;

    const rect = e.target.getBoundingClientRect();
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

  const handleGalleryItemClick = useCallback((img) => {
    setImageName(img.name);
    loadImageFromUrl(img.dataUrl);
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
    <div className="editor-container">
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
              <div className="canvas-wrapper">
                <canvas ref={canvasRef} />
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
                        onLoad={(e) => setCropAspectRatio(e.target.naturalWidth / e.target.naturalHeight)}
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
                onClick={e => (e.target.value = null)} 
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
                          style={{ '--thumb-percent': `${((magneticThreshold - MAGNETIC_THRESHOLD_MIN) / (MAGNETIC_THRESHOLD_MAX - MAGNETIC_THRESHOLD_MIN)) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <button onClick={finishPolygonDrawing} className="btn btn--warning btn-full btn--icon-flex grid-col-full">
                    <Check size={18} />描画完了
                  </button>
                </>
              )}
              
              {drawingObject && drawingObject.type === 'polygon' && (
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
                  <a 
                    href={croppedImageUrl} 
                    download="cropped_image.webp" 
                    className="btn btn--primary btn-full btn--icon-flex"
                  >
                    <Download size={18} />ダウンロード
                  </a>
                  <button 
                    onClick={handleSaveToGallery} 
                    className="btn btn--success btn-full btn--icon-flex"
                  >
                    <FolderPlus size={18} />共有ギャラリーに保存
                  </button>
                </>
              )}
            </div>

            {drawingObject && drawingObject.type === 'path' && (
              <div className="slider-group">
                <label>曲線の滑らかさ補正</label>
                <input 
                  type="range" 
                  min={PATH_SMOOTHING_MIN} 
                  max={PATH_SMOOTHING_MAX} 
                  value={pathSmoothing}
                  onChange={e => setPathSmoothing(parseInt(e.target.value, 10))}
                  style={{ '--thumb-percent': `${((pathSmoothing - PATH_SMOOTHING_MIN) / (PATH_SMOOTHING_MAX - PATH_SMOOTHING_MIN)) * 100}%` }}
                />
                <span className="slider-group__value">{pathSmoothing}</span>
              </div>
            )}


            {drawingObject && drawingObject.type !== 'polygon' && drawingObject.type !== 'path' && (
              <div className="adjustment-controls">
                <h3>選択中の図形の調整</h3>
                <div className="adjustment-group">
                  {['top', 'right', 'left', 'bottom'].map((side) => (
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
