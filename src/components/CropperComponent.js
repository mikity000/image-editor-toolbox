import { useRef, useEffect, useState, useContext } from 'react';
import { Canvas } from 'fabric';
import { useCropperInteraction } from '../hooks/useCropperInteraction';
import { useImageCrop } from '../hooks/useImageCrop';
import { useImageUpload } from '../hooks/useImageUpload';
import { GalleryContext } from '../context/GalleryContext';
import SidebarTray from './SidebarTray';
import { getSequentialName } from '../utils/imageUtils';
import { isMobileDevice } from '../utils/deviceUtils';

export default function CropperComponent() {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [pathSmoothing, setPathSmoothing] = useState(20);
  const [invertCrop, setInvertCrop] = useState(false);
  const [exportBoundsCanvas, setExportBoundsCanvas] = useState(null);
  
  const { galleryImages, addImages, removeImage, renameImage, isGalleryOpen, setIsGalleryOpen } = useContext(GalleryContext);
  const { imageLoaded, uploadImage, loadImageFromUrl, imageName, setImageName } = useImageUpload(fabricCanvasRef, setCroppedImageUrl);

  const isMobile = isMobileDevice();

  const {
    croppingMode, drawingObject, isDrawingPolygon, autoCropCount, activeVertexPos,
    isMagneticMode, setIsMagneticMode, magneticThreshold, setMagneticThreshold,
    startCropping, finishPolygonDrawing, editPolygonVertices, adjustCroppingShape, adjustActiveVertex, deleteActiveVertex, deleteActiveShape, getTempPolygon, selectVertexAtPosition, reset
  } = useCropperInteraction(fabricCanvasRef, imageLoaded, setCroppedImageUrl, pathSmoothing);

  const { crop } = useImageCrop(fabricCanvasRef, setCroppedImageUrl, invertCrop, setExportBoundsCanvas);

  const handleCroppedImageClick = (e) => {
    if (!isDrawingPolygon) return;

    const rect = e.target.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    if (exportBoundsCanvas) {
      const canvasX = exportBoundsCanvas.left + xRatio * exportBoundsCanvas.width;
      const canvasY = exportBoundsCanvas.top + yRatio * exportBoundsCanvas.height;
      
      selectVertexAtPosition(canvasX, canvasY);
    }
  };

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
    const canvas = new Canvas(canvasRef.current, {
      selection: false,
      hoverCursor: 'default',
      width: wrapperEl.clientWidth,
      height: wrapperEl.clientHeight,
    });
    fabricCanvasRef.current = canvas;

    return () => {
      canvas.dispose();
    };
  }, []);

  return (
    <div className="editor-container">
      <div className="editor-layout">
        <div className="editor-left-sidebar">
          <SidebarTray
            title="共有ギャラリー"
            isOpen={isGalleryOpen}
            onToggle={() => setIsGalleryOpen(!isGalleryOpen)}
            emptyMessage={<>ギャラリーは空です。<br />[共有ギャラリーに保存]ボタンを押下して画像を追加してください。</>}
            items={galleryImages.map(img => ({
              id: img.id,
              name: img.name,
              dataUrl: img.dataUrl,
              rawItem: img
            }))}
            onClickItem={(img) => {
              setImageName(img.name);
              loadImageFromUrl(img.dataUrl);
            }}
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
                    <img 
                      src={croppedImageUrl} 
                      alt="Cropped Result" 
                      id="croppedResult" 
                      onClick={handleCroppedImageClick}
                      className="result-image"
                    />
                    {isDrawingPolygon && activeVertexPos && exportBoundsCanvas && (
                      <div style={{
                        position: 'absolute',
                        left: `${((activeVertexPos.x - exportBoundsCanvas.left) / exportBoundsCanvas.width) * 100}%`,
                        top: `${((activeVertexPos.y - exportBoundsCanvas.top) / exportBoundsCanvas.height) * 100}%`,
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(50, 205, 50, 0.9)',
                        border: '1px solid rgba(0, 0, 0, 0.6)',
                        transform: (() => {
                          const ratioX = (activeVertexPos.x - exportBoundsCanvas.left) / exportBoundsCanvas.width;
                          const ratioY = (activeVertexPos.y - exportBoundsCanvas.top) / exportBoundsCanvas.height;
                          const dx = ratioX - 0.5;
                          const dy = ratioY - 0.5;
                          const len = Math.sqrt(dx * dx + dy * dy) || 1;
                          return `translate(calc(-50% + ${(dx / len) * 50}%), calc(-50% + ${(dy / len) * 50}%))`;
                        })(),
                        pointerEvents: 'none',
                        boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
                        zIndex: 10
                      }} />
                    )}
                  </div>
                ) : (
                  <div className="result-placeholder">
                    <svg viewBox="0 0 24 24" width="134" height="134" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: '1rem' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
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
              <input type="file" accept="image/*" className="file-input__control" onClick={e => e.target.value = null} onChange={uploadImage} />
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
              <button onClick={() => startCropping('rect')} className="btn shape-btn" disabled={!imageLoaded}>
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
              </button>
              <button onClick={() => startCropping('circle')} className="btn shape-btn" disabled={!imageLoaded}>
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
              </button>
              <button onClick={() => startCropping('polygon')} className="btn shape-btn" disabled={!imageLoaded}>
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 22 8.5 18.5 20 5.5 20 2 8.5"></polygon>
                </svg>
              </button>
              <button onClick={() => startCropping('path')} className="btn shape-btn" disabled={!imageLoaded}>
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L8.5 19.5 2 22l2.5-6.5L17 3z"></path>
                  <path d="M15 5l4 4"></path>
                  <path d="M2 23h20"></path>
                </svg>
              </button>
              
              {isDrawingPolygon && !drawingObject && (
                <>
                  <div className="setting-box slider-group--block mb-8" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="magneticModeCheckbox" className={`custom-checkbox-label custom-checkbox-label--flex custom-checkbox-label--full ${isMagneticMode ? 'mb-8' : 'mb-0'}`}>
                      <input type="checkbox" id="magneticModeCheckbox" checked={isMagneticMode} onChange={(e) => setIsMagneticMode(e.target.checked)} className="custom-checkbox" />
                      吸着モード {isMagneticMode && <span className="sensitivity-label">感度: {magneticThreshold}</span>}
                    </label>
                    {isMagneticMode && (
                      <div className="slider-wrapper">
                        <input type="range" min="10" max="150" value={magneticThreshold}
                          onChange={e => setMagneticThreshold(parseInt(e.target.value, 10))}
                          style={{ '--thumb-percent': `${((magneticThreshold - 10) / 140) * 100}%`, width: '100%', margin: 0, display: 'block' }}
                        />
                      </div>
                    )}
                  </div>
                  <button onClick={finishPolygonDrawing} className="btn btn--warning btn-full" style={{ gridColumn: '1 / -1' }}>描画完了</button>
                </>
              )}
              
              {drawingObject && drawingObject.type === 'polygon' && (
                <button onClick={editPolygonVertices} className="btn btn--warning btn-full">頂点を再編集</button>
              )}
              {drawingObject && (
                <button onClick={deleteActiveShape} className="btn btn--danger btn-full">削除</button>
              )}
              <button onClick={reset} className="btn btn--danger btn-full">リセット</button>

              {croppedImageUrl && (
                <>
                  <a 
                    href={croppedImageUrl} 
                    download="cropped_image.webp" 
                    className="btn btn--primary btn-full"
                    style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                  >
                    ダウンロード
                  </a>
                  <button 
                    onClick={() => {
                      if (!croppedImageUrl) return;
                      const newName = getSequentialName(imageName, galleryImages);
                      addImages({ name: newName, dataUrl: croppedImageUrl });
                    }} 
                    className="btn btn--success btn-full"
                  >
                    共有ギャラリーに保存
                  </button>
                </>
              )}
            </div>

            {drawingObject && drawingObject.type === 'path' && (
              <div className="slider-group">
                <label>曲線の滑らかさ補正</label>
                <input type="range" min="0" max="50" value={pathSmoothing}
                  onChange={e => setPathSmoothing(parseInt(e.target.value, 10))}
                  style={{ '--thumb-percent': `${(pathSmoothing / 50) * 100}%` }}
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
                  <div className="adjustment-box" style={{ gridColumn: '1 / -1' }}>
                    <h4>削除</h4>
                    <button onClick={deleteActiveVertex} className="btn btn--danger btn--auto-width btn-full" style={{ width: '100%' }}>頂点を削除</button>
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