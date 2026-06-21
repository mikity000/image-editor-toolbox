import { useEffect, useRef, useState, useContext } from 'react';
import { Canvas, Image as FabricImage } from 'fabric';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useCanvasZoomPan } from '../hooks/useCanvasZoomPan';
import { useSnappingGuides } from '../hooks/useSnappingGuides';
import { GalleryContext } from '../context/GalleryContext';
import GalleryTray from './GalleryTray';
import CollapsibleTray from './CollapsibleTray';
import TrayItem from './TrayItem';
import { convertToWebP } from '../utils/webpConverter';
import { getSequentialName, fileToDataUrl } from '../utils/imageUtils';
import { isMobileDevice } from '../utils/deviceUtils';

export default function CombinerComponent() {
  const [imageList, setImageList] = useState([]);
  const [isCanvasListOpen, setIsCanvasListOpen] = useState(true);
  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [guideThickness, setGuideThickness] = useState(1);
  const isMobile = isMobileDevice();

  const { galleryImages, addImages } = useContext(GalleryContext);

  // Custom hooks
  const { saveState, undo, redo } = useUndoRedo(fabricCanvas, setImageList);
  const { zoomLevel } = useCanvasZoomPan(fabricCanvas, isMobile);
  
  useSnappingGuides(fabricCanvas, guideThickness, setSelectedSize, saveState);

  const addImageFromGallery = (image) => {
    if (!fabricCanvas) return;
    const vpt = fabricCanvas.viewportTransform;
    const zoom = fabricCanvas.getZoom();
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();
    
    const left = (-vpt[4] + canvasWidth / 2) / zoom;
    const top = (-vpt[5] + canvasHeight / 2) / zoom;

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = image.dataUrl;
    imgEl.onload = () => {
      const maxW = canvasWidth * 0.5 / zoom;
      const maxH = canvasHeight * 0.5 / zoom;
      let scale = 1;
      if (imgEl.width > maxW || imgEl.height > maxH) {
        scale = Math.min(maxW / imgEl.width, maxH / imgEl.height);
      }

      const fabricImg = new FabricImage(imgEl, {
        left: left - (imgEl.width * scale) / 2,
        top: top - (imgEl.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        angle: 0,
        selectable: true,
        hasControls: true,
        lockUniScaling: false,
      });
      fabricImg.origSrc = image.dataUrl;
      fabricImg.fileName = image.name;
      fabricImg.setControlsVisibility({ mtr: false });
      fabricCanvas.add(fabricImg);
      fabricCanvas.setActiveObject(fabricImg);
      fabricCanvas.renderAll();
      saveState();
      setImageList(fabricCanvas.getObjects());
    };
  };

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
    const loadPromises = files.map(async file => {
        const dataURL = await fileToDataUrl(file);
        return new Promise(resolve => {
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

  const adjustLayer = (action) => {
    if (!fabricCanvas) return;
    const activeObjs = fabricCanvas.getActiveObjects();
    if (!activeObjs.length) return;

    const objects = fabricCanvas.getObjects();
    // 現在のインデックス順（背面→前面）にソート
    activeObjs.sort((a, b) => objects.indexOf(a) - objects.indexOf(b));

    if (action === 'front') {
      activeObjs.forEach(obj => fabricCanvas.bringObjectToFront(obj));
    } else if (action === 'back') {
      [...activeObjs].reverse().forEach(obj => fabricCanvas.sendObjectToBack(obj));
    } else if (action === 'forward') {
      [...activeObjs].reverse().forEach(obj => fabricCanvas.bringObjectForward(obj));
    } else if (action === 'backward') {
      activeObjs.forEach(obj => fabricCanvas.sendObjectBackwards(obj));
    }

    fabricCanvas.requestRenderAll();
    saveState();
    setImageList([...fabricCanvas.getObjects()]);
  };

  const getExportDataURLPng = () => {
    if (!fabricCanvas) return null;
    const imageObjects = fabricCanvas.getObjects();
    if (!imageObjects.length) return null;

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
      // multiplier の計算
      let maxScaleFactor = 1;
      imageObjects.forEach(obj => {
        if (obj._element) {
          const origW = obj._element.naturalWidth || obj._element.width;
          const origH = obj._element.naturalHeight || obj._element.height;
          const scaledW = obj.getScaledWidth();
          const scaledH = obj.getScaledHeight();
          if (scaledW > 0 && scaledH > 0) {
            const factorX = origW / scaledW;
            const factorY = origH / scaledH;
            maxScaleFactor = Math.max(maxScaleFactor, factorX, factorY);
          }
        }
      });

      const MAX_EXPORT_PIXELS = 4096;
      const currentMaxDim = Math.max(exportWidth, exportHeight);
      if (currentMaxDim * maxScaleFactor > MAX_EXPORT_PIXELS) {
        maxScaleFactor = MAX_EXPORT_PIXELS / currentMaxDim;
      }
      maxScaleFactor = Math.max(1, maxScaleFactor);

      return fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        left: minX,
        top: minY,
        width: exportWidth,
        height: exportHeight,
        multiplier: maxScaleFactor,
      });
    }
    return null;
  };

  const download = async () => {
    const dataURLPng = getExportDataURLPng();
    if (!dataURLPng) return;

    const dataURL = await convertToWebP(dataURLPng);
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'combined_trimmed.webp';
    link.click();
  };

  const saveToGallery = async () => {
    const dataURLPng = getExportDataURLPng();
    if (!dataURLPng) return;

    const newName = getSequentialName('結合', galleryImages);
    const dataURL = await convertToWebP(dataURLPng);
    addImages({
      name: newName,
      dataUrl: dataURL
    });
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
      <div className="editor-layout">
        <div className="editor-left-sidebar">
          <GalleryTray onSelectImage={addImageFromGallery} actionText="追加する" />
          
          <CollapsibleTray
            title="画像一覧"
            isOpen={isCanvasListOpen}
            onToggle={() => setIsCanvasListOpen(!isCanvasListOpen)}
            emptyMessage={<>キャンバスは空です。<br />画像をアップロードするか、ギャラリーから追加してください。</>}
            items={imageList}
            renderItem={(imgObj, index) => (
              <TrayItem
                key={index}
                src={imgObj.origSrc}
                alt={imgObj.fileName || 'canvas-image'}
                name={imgObj.fileName || '不明なファイル名'}
                onClick={() => clickImageList(imgObj)}
              />
            )}
          />
        </div>

        <div className="editor-main combiner-main">
          <div className="canvas-wrapper">
            <canvas ref={canvasRef} />
            <div className="instructions">
              <small className="instructions__text">
                {isMobile ? "ピンチでズーム、二本指ドラッグでパンが可能です。"
                  : "スクロールでズーム、Altキー + ドラッグでパンできます。"}
              </small>
            </div>
          </div>
        </div>

        <div className="editor-sidebar">
          <div className="sidebar-sticky-content">
            <div className="file-input">
              <input type="file" accept="image/*" multiple className="file-input__control"
                onClick={e => (e.target.value = null)} onChange={uploadImage}
              />
            </div>

            <div className="button-group sidebar-buttons">
              <button className="btn" onClick={undo}>Undo</button>
              <button className="btn" onClick={redo}>Redo</button>

              <div className="btn-full layer-controls-grid">
                <button className="btn btn--nowrap" onClick={() => adjustLayer('front')}>最前面へ</button>
                <button className="btn btn--nowrap" onClick={() => adjustLayer('back')}>最背面へ</button>
                <button className="btn btn--nowrap" onClick={() => adjustLayer('forward')}>前面へ</button>
                <button className="btn btn--nowrap" onClick={() => adjustLayer('backward')}>背面へ</button>
              </div>

              <button className="btn btn--danger btn-full mt-10" onClick={deleteSelected}>選択画像削除</button>
              <button className="btn btn--primary btn-full" onClick={download}>ダウンロード</button>
              <button className="btn btn--success btn-full" onClick={saveToGallery}>共有ギャラリーに保存</button>
            </div>

            <div className="slider-group">
              <label>ガイドラインの太さ</label>
              <input type="range" min="1" max="20" value={guideThickness}
                onChange={e => setGuideThickness(parseInt(e.target.value, 10))}
                style={{ '--thumb-percent': `${((guideThickness - 1) / (20 - 1)) * 100}%` }}
              />
              <span className="slider-group__value">{guideThickness}px</span>
            </div>

            <div className="selected-size">
              <div className="selected-size__info">
                <strong>サイズ</strong>
                <span className="selected-size__value">
                  {selectedSize ? `幅 ${selectedSize.width.toFixed(0)} px, 高さ ${selectedSize.height.toFixed(0)} px` : " ー"}
                </span>
              </div>
              <div className="selected-size__zoom">
                <strong>ズーム</strong>
                <span className="selected-size__zoom-value">
                  {`${Math.round(zoomLevel * 100)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}