import { useRef, useEffect, useState } from 'react';
import { Canvas } from 'fabric';
import { useCropperInteraction } from '../hooks/useCropperInteraction';
import { useImageCrop } from '../hooks/useImageCrop';
import { useImageUpload } from '../hooks/useImageUpload';

export default function CropperComponent() {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [pathSmoothing, setPathSmoothing] = useState(20);
  
  const { imageLoaded, uploadImage } = useImageUpload(fabricCanvasRef, setCroppedImageUrl);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;

  const {
    croppingMode, drawingObject, isDrawingPolygon,
    startCropping, finishPolygonDrawing, editPolygonVertices, adjustCroppingShape, reset
  } = useCropperInteraction(fabricCanvasRef, imageLoaded, setCroppedImageUrl, pathSmoothing);

  const { crop } = useImageCrop(fabricCanvasRef, drawingObject, croppingMode, setCroppedImageUrl);

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
      <div className="file-input">
        <input type="file" accept="image/*" className="file-input__control" onClick={e => e.target.value = null} onChange={uploadImage} />
      </div>

      <div className="button-group">
        <button onClick={() => startCropping('rect')} className="btn" disabled={!imageLoaded}>四角形</button>
        <button onClick={() => startCropping('circle')} className="btn" disabled={!imageLoaded}>円</button>
        <button onClick={() => startCropping('polygon')} className="btn" disabled={!imageLoaded}>多角形</button>
        <button onClick={() => startCropping('path')} className="btn" disabled={!imageLoaded}>フリーハンド</button>
        
        {isDrawingPolygon && !drawingObject && (
          <button onClick={finishPolygonDrawing} className="btn btn--warning">描画完了</button>
        )}
        
        {drawingObject && croppingMode === 'polygon' && (
          <button onClick={editPolygonVertices} className="btn btn--warning">頂点を再編集</button>
        )}
        
        <button onClick={crop} className="btn btn--success" disabled={!drawingObject}>トリミング実行</button>
        <button onClick={reset} className="btn btn--danger">リセット</button>
      </div>

      {croppingMode === 'path' && (
        <div className="slider-group">
          <label>曲線の滑らかさ補正:</label>
          <input type="range" min="0" max="50" value={pathSmoothing}
            onChange={e => setPathSmoothing(parseInt(e.target.value, 10))}
            style={{ '--thumb-percent': `${(pathSmoothing / 50) * 100}%` }}
          />
          <span>{pathSmoothing}</span>
        </div>
      )}

      {croppingMode && croppingMode !== 'polygon' && croppingMode !== 'path' && (
        <div className="adjustment-controls">
          <h3>トリミング枠の調整</h3>
          <div className="adjustment-group">
            {['top', 'left', 'right', 'bottom'].map((side) => (
              <div key={side} className="adjustment-box">
                <h4>{{ 'top': '上辺', 'left': '左辺', 'right': '右辺', 'bottom': '下辺' }[side]}</h4>
                <button onClick={() => adjustCroppingShape(side, -0.5)} className="btn">-</button>
                <button onClick={() => adjustCroppingShape(side, 0.5)} className="btn">+</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="canvas-wrapper" style={{ height: isMobile ? '600px' : '800px' }}>
        <canvas ref={canvasRef} />
      </div>

      {croppedImageUrl && (
        <div className="result-container">
          <h2 className="result-title">トリミング結果</h2>
          <img src={croppedImageUrl} alt="Cropped Result" id="croppedResult" />
          <div>
            <a href={croppedImageUrl} download="cropped_image.png" className="btn download-btn">画像をダウンロード</a>
          </div>
        </div>
      )}
    </div>
  );
}