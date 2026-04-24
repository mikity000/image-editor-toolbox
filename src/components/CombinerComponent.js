import { useEffect, useRef, useState } from 'react';
import { Canvas, Image as FabricImage } from 'fabric';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useCanvasZoomPan } from '../hooks/useCanvasZoomPan';
import { useSnappingGuides } from '../hooks/useSnappingGuides';

export default function CombinerComponent() {
  const [imageList, setImageList] = useState([]);
  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [guideThickness, setGuideThickness] = useState(1);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;

  // Custom hooks
  const { saveState, undo, redo } = useUndoRedo(fabricCanvas, setImageList);
  const { zoomLevel } = useCanvasZoomPan(fabricCanvas, isMobile);
  
  useSnappingGuides(fabricCanvas, guideThickness, setSelectedSize, saveState);

  useEffect(() => {
    if (!canvasRef.current) return;
    const wrapperEl = canvasRef.current.parentElement;
    const canvas = new Canvas(canvasRef.current, {
      width: wrapperEl.clientWidth,
      height: wrapperEl.clientHeight,
      backgroundColor: 'transparent',
      selection: true,
      selectionKey: 'ctrlKey',
    });
    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, []);

  const uploadImage = e => {
    if (!fabricCanvas) return;
    const vpt = fabricCanvas.viewportTransform;
    const zoom = fabricCanvas.getZoom();
    const left = -vpt[4] / zoom;
    const top = -vpt[5] / zoom;

    const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    const loadPromises = files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = event => {
          const dataURL = event.target.result;
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.src = dataURL;
          imgEl.onload = () => {
            const fabricImg = new FabricImage(imgEl, {
              left: left,
              top: top,
              scaleX: 1,
              scaleY: 1,
              angle: 0,
              selectable: true,
              hasControls: true,
              lockUniScaling: false,
            });
            fabricImg.origSrc = dataURL;
            fabricImg.fileName = file.name;
            fabricImg.setControlsVisibility({ mtr: false });
            fabricCanvas.add(fabricImg);
            resolve();
          };
          imgEl.onerror = () => resolve();
        }
        reader.readAsDataURL(file);
      });
    });

    Promise.all(loadPromises).then(() => {
      fabricCanvas.renderAll();
      saveState();
      setImageList(fabricCanvas.getObjects());
    });
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjs = fabricCanvas.getActiveObjects();
    if (!activeObjs.length) return;
    activeObjs.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    saveState();
    setImageList(fabricCanvas.getObjects());
  };

  const download = () => {
    if (!fabricCanvas) return;
    const imageObjects = fabricCanvas.getObjects();
    if (!imageObjects.length) return;

    fabricCanvas.discardActiveObject();
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    imageObjects.forEach(obj => {
      const l = obj.left, t = obj.top;
      const w = obj.getScaledWidth(), h = obj.getScaledHeight();
      minX = Math.min(minX, l);
      minY = Math.min(minY, t);
      maxX = Math.max(maxX, l + w);
      maxY = Math.max(maxY, t + h);
    });

    const exportWidth = maxX - minX;
    const exportHeight = maxY - minY;

    if (exportWidth > 0 && exportHeight > 0) {
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        left: minX,
        top: minY,
        width: exportWidth,
        height: exportHeight,
        multiplier: 1,
      });
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = 'combined_trimmed.png';
      link.click();
    }
  };

  const clickImageList = imgObj => {
    if (!fabricCanvas) return;
    const centerPoint = imgObj.getCenterPoint();
    const worldCenterX = centerPoint.x;
    const worldCenterY = centerPoint.y;
    const zoom = fabricCanvas.getZoom();
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();
    const tx = canvasWidth / 2 - worldCenterX * zoom;
    const ty = canvasHeight / 2 - worldCenterY * zoom;

    fabricCanvas.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
    fabricCanvas.renderAll();
  };

  return (
    <div className="editor-container">
      <div className="file-input">
        <input type="file" accept="image/*" multiple className="file-input__control"
          onClick={e => (e.target.value = null)} onChange={uploadImage}
        />
        <small className="file-input__hint">
          （PNG/JPEG などの画像を複数選択できます）
        </small>
      </div>

      <div className="button-group">
        <button className="btn" onClick={undo}>Undo</button>
        <button className="btn" onClick={redo}>Redo</button>
        <button className="btn btn--danger" onClick={deleteSelected}>選択画像削除</button>
        <button className="btn btn--success" onClick={download}>ダウンロード</button>
      </div>

      <div className="slider-group">
        <label>ガイドラインの太さ：</label>
        <input type="range" min="1" max="20" value={guideThickness}
          onChange={e => setGuideThickness(parseInt(e.target.value, 10))}
          style={{ '--thumb-percent': `${((guideThickness - 1) / (20 - 1)) * 100}%` }}
        />
        <span className="slider-group__value">{guideThickness}px</span>
      </div>

      <div className="selected-size">
        <div className="selected-size__info">
          <strong>選択中画像 サイズ：</strong>
          <span className="selected-size__value">
            {selectedSize ? `幅 ${selectedSize.width.toFixed(0)} px, 高さ ${selectedSize.height.toFixed(0)} px` : " ー"}
          </span>
        </div>
        <div className="selected-size__zoom">
          <strong>ズーム：</strong>
          <span className="selected-size__zoom-value">
            {`${Math.round(zoomLevel * 100)}%`}
          </span>
        </div>
      </div>

      <div className="canvas-wrapper" style={{ height: isMobile ? '500px' : '700px' }}>
        <canvas ref={canvasRef} />
      </div>

      {imageList.length > 0 && (
        <div className="image-list-container" style={{ minHeight: 'auto' }}>
          <div className="image-list" style={{ display: 'flex', gap: '10px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '10px', maxHeight: 'none' }}>
            {imageList.map((imgObj, index) => (
              <div key={index} className="image-preview-item" style={{ flex: '0 0 100px' }} onClick={() => clickImageList(imgObj)}>
                <img src={imgObj.origSrc} className="thumbnail" alt={`canvas-image-${index}`} />
                <div className="image-info">
                   <p className="file-name">{imgObj.fileName || '不明なファイル名'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="instructions">
        <small className="instructions__text">
          {isMobile ? "ピンチでズーム、二本指ドラッグでパンが可能です。"
            : "スクロールでズーム、Altキー + ドラッグでパンできます。"}
        </small>
      </div>
    </div>
  );
};