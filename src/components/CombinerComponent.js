import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Undo2, Redo2, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Trash2, Download, FolderPlus } from 'lucide-react';

import { Canvas, FabricImage } from 'fabric';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useCanvasZoomPan } from '../hooks/useCanvasZoomPan';
import { useSnappingGuides } from '../hooks/useSnappingGuides';
import { useGallery } from '../context/GalleryContext';
import SidebarTray from './SidebarTray';
import { convertToWebP } from '../utils/webpConverter';
import { getSequentialName, fileToDataUrl, generateUniqueId } from '../utils/imageUtils';
import { isMobileDevice } from '../utils/deviceUtils';
import { COMBINE_CONFIG, IMAGE_CONFIG } from '../constants/Constants';

export default function CombinerComponent() {
  const [imageList, setImageList] = useState([]);
  const [isCanvasListOpen, setIsCanvasListOpen] = useState(true);
  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [guideThickness, setGuideThickness] = useState(COMBINE_CONFIG.GUIDE_THICKNESS_DEFAULT);
  const isMobile = isMobileDevice();


  const { galleryImages, addImages, removeImage, renameImage, isGalleryOpen, setIsGalleryOpen } = useGallery();


  const galleryItems = useMemo(() => {
    return galleryImages.map(img => ({
      id: img.id,
      name: img.name,
      dataUrl: img.dataUrl,
      rawItem: img
    }));
  }, [galleryImages]);

  // カスタムフック
  const { saveState, undo, redo } = useUndoRedo(fabricCanvas, setImageList);
  const { zoomLevel } = useCanvasZoomPan(fabricCanvas, isMobile);
  
  useSnappingGuides(fabricCanvas, guideThickness, setSelectedSize, saveState);

  // ギャラリーからの画像追加
  const addImageFromGallery = useCallback((image) => {
    if (!fabricCanvas) return;
    const vpt = fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const zoom = fabricCanvas.getZoom();
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();
    
    const left = (-vpt[4] + canvasWidth / 2) / zoom;
    const top = (-vpt[5] + canvasHeight / 2) / zoom;

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = image.dataUrl;
    imgEl.onload = () => {
      const maxW = (canvasWidth * 0.5) / zoom;
      const maxH = (canvasHeight * 0.5) / zoom;
      let scale = 1;
      if (imgEl.width > maxW || imgEl.height > maxH) {
        scale = Math.min(maxW / (imgEl.width || 1), maxH / (imgEl.height || 1));
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
      fabricImg.id = generateUniqueId('canvas-img');
      fabricImg.origSrc = image.dataUrl;
      fabricImg.fileName = image.name;
      fabricImg.setControlsVisibility({ mtr: false });
      fabricCanvas.add(fabricImg);
      fabricCanvas.setActiveObject(fabricImg);
      fabricCanvas.renderAll();
      saveState();
      setImageList(fabricCanvas.getObjects());
    };
  }, [fabricCanvas, saveState]);

  // Canvas の初期化・破棄およびリサイズ監視
  useEffect(() => {
    if (!canvasRef.current) return;
    const wrapperEl = canvasRef.current.parentElement;
    if (!wrapperEl) return;

    const canvas = new Canvas(canvasRef.current, {
      width: wrapperEl.clientWidth,
      height: wrapperEl.clientHeight,
      backgroundColor: 'transparent',
      selection: true,
      selectionKey: 'ctrlKey',
    });

    // グリッド線（マス目）を描画するイベントハンドラー
    canvas.on('before:render', (opt) => drawGrid(canvas, opt.ctx));

    // テーマ（data-theme）変更の監視
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          canvas.requestRenderAll();
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // コンテナのリサイズ監視
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

    setFabricCanvas(canvas);
    canvas.requestRenderAll();

    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, []);

  // 画像アップロード
  const uploadImage = useCallback((e) => {
    if (!fabricCanvas) return;
    const vpt = fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const zoom = fabricCanvas.getZoom();
    const left = -vpt[4] / zoom;
    const top = -vpt[5] / zoom;

    const files = Array.from(e.target.files || []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;

    const loadPromises = files.map(async (file) => {
      try {
        const dataURL = await fileToDataUrl(file);
        return new Promise((resolve) => {
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.src = dataURL;
          imgEl.onload = () => {
            const fabricImg = new FabricImage(imgEl, {
              left,
              top,
              scaleX: 1,
              scaleY: 1,
              angle: 0,
              selectable: true,
              hasControls: true,
              lockUniScaling: false,
            });
            fabricImg.id = generateUniqueId('canvas-img');
            fabricImg.origSrc = dataURL;
            fabricImg.fileName = file.name;
            fabricImg.setControlsVisibility({ mtr: false });
            fabricCanvas.add(fabricImg);
            resolve();
          };
          imgEl.onerror = () => resolve();
        });
      } catch (err) {
        console.error('画像読み込みエラー:', err);
      }
    });

    Promise.all(loadPromises).then(() => {
      fabricCanvas.renderAll();
      saveState();
      setImageList(fabricCanvas.getObjects());
    });
  }, [fabricCanvas, saveState]);

  // 選択画像の削除
  const deleteSelected = useCallback(() => {
    if (!fabricCanvas) return;
    const activeObjs = fabricCanvas.getActiveObjects();
    if (!activeObjs.length) return;
    activeObjs.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    saveState();
    setImageList(fabricCanvas.getObjects());
  }, [fabricCanvas, saveState]);

  // キャンバス画像一覧からの削除
  const deleteCanvasImages = useCallback((ids) => {
    if (!fabricCanvas) return;
    const idSet = new Set(ids);
    const objects = fabricCanvas.getObjects();
    const toDelete = objects.filter(obj => idSet.has(obj.id));
    if (toDelete.length === 0) return;
    
    toDelete.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    saveState();
    setImageList(fabricCanvas.getObjects());
  }, [fabricCanvas, saveState]);

  // キャンバス画像の名前変更
  const renameCanvasImage = useCallback((id, newName) => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    const target = objects.find(obj => obj.id === id);
    if (target) {
      target.fileName = newName;
      saveState();
      setImageList([...fabricCanvas.getObjects()]);
    }
  }, [fabricCanvas, saveState]);

  // レイヤー順の調整
  const adjustLayer = useCallback((action) => {
    if (!fabricCanvas) return;
    const activeObjs = fabricCanvas.getActiveObjects();
    if (!activeObjs.length) return;

    const objects = fabricCanvas.getObjects();
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
  }, [fabricCanvas, saveState]);

  // PNG形式でのエクスポートDataURL取得（安全なビューポート復元対応）
  const getExportDataURLPng = useCallback(() => {
    if (!fabricCanvas) return null;
    const imageObjects = fabricCanvas.getObjects().filter(o => !o.isGuide);
    if (!imageObjects.length) return null;

    const originalVpt = [...(fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0])];
    fabricCanvas.discardActiveObject();
    fabricCanvas.isExporting = true;

    try {
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

      if (exportWidth <= 0 || exportHeight <= 0) return null;

      let maxScaleFactor = 1;
      imageObjects.forEach(obj => {
        if (obj._element) {
          const origW = obj._element.naturalWidth || obj._element.width || 0;
          const origH = obj._element.naturalHeight || obj._element.height || 0;
          const scaledW = obj.getScaledWidth();
          const scaledH = obj.getScaledHeight();
          if (scaledW > 0 && scaledH > 0) {
            const factorX = origW / scaledW;
            const factorY = origH / scaledH;
            maxScaleFactor = Math.max(maxScaleFactor, factorX, factorY);
          }
        }
      });

      const MAX_EXPORT_PIXELS = IMAGE_CONFIG.MAX_EXPORT_PIXELS;
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
    } finally {
      fabricCanvas.isExporting = false;
      fabricCanvas.setViewportTransform(originalVpt);
      fabricCanvas.requestRenderAll();
    }
  }, [fabricCanvas]);

  // ダウンロード処理
  const download = useCallback(async () => {
    const dataURLPng = getExportDataURLPng();
    if (!dataURLPng) return;

    try {
      const dataURL = await convertToWebP(dataURLPng);
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = 'combined_trimmed.webp';
      link.click();
    } catch (err) {
      console.error('画像のダウンロードに失敗しました:', err);
    }
  }, [getExportDataURLPng]);

  // ギャラリーへの保存
  const saveToGallery = useCallback(async () => {
    const dataURLPng = getExportDataURLPng();
    if (!dataURLPng) return;

    try {
      const newName = getSequentialName('結合', galleryImages);
      const dataURL = await convertToWebP(dataURLPng);
      addImages({
        name: newName,
        dataUrl: dataURL
      });
    } catch (err) {
      console.error('ギャラリーへの保存に失敗しました:', err);
    }
  }, [getExportDataURLPng, galleryImages, addImages]);

  // 画像一覧アイテムをクリックしてズーム・フォーカス
  const clickImageList = useCallback((imgObj) => {
    if (!fabricCanvas || !imgObj) return;
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
  }, [fabricCanvas]);

  const normalizedCanvasItems = useMemo(() => {
    return imageList.map((imgObj) => {
      if (!imgObj.id) {
        imgObj.id = generateUniqueId('canvas-img');
      }
      return {
        id: imgObj.id,
        name: imgObj.fileName || '名称未設定',
        dataUrl: imgObj.origSrc,
        rawItem: imgObj
      };
    });
  }, [imageList]);

  const { GUIDE_THICKNESS_MIN, GUIDE_THICKNESS_MAX } = COMBINE_CONFIG;

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
            onClickItem={addImageFromGallery}
            onDeleteItems={removeImage}
            onRenameItem={renameImage}
            actionText="追加する"
          />
          
          <SidebarTray
            title="画像一覧"
            trayType="list"
            isOpen={isCanvasListOpen}
            onToggle={() => setIsCanvasListOpen(!isCanvasListOpen)}
            emptyMessage={<>キャンバスは空です。<br />画像をアップロードするか、ギャラリーから追加してください。</>}
            items={normalizedCanvasItems}
            onClickItem={clickImageList}
            onDeleteItems={deleteCanvasImages}
            onRenameItem={renameCanvasImage}
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
              <input 
                type="file" 
                accept="image/*" 
                multiple 
                className="file-input__control"
                onClick={e => (e.target.value = null)} 
                onChange={uploadImage}
              />
            </div>

            <div className="button-group sidebar-buttons">
              <div className="undo-redo-wrapper">
                <button onClick={undo} className="btn btn-undo-redo" aria-label="元に戻す">
                  <Undo2 size={18} />
                </button>
                <button onClick={redo} className="btn btn-undo-redo" aria-label="やり直す">
                  <Redo2 size={18} />
                </button>
              </div>

              <div className="btn-full layer-controls-grid">
                <button className="btn btn--nowrap" onClick={() => adjustLayer('front')}><ChevronsUp size={16} />最前面へ</button>
                <button className="btn btn--nowrap" onClick={() => adjustLayer('back')}><ChevronsDown size={16} />最背面へ</button>
                <button className="btn btn--nowrap" onClick={() => adjustLayer('forward')}><ChevronUp size={16} />前面へ</button>
                <button className="btn btn--nowrap" onClick={() => adjustLayer('backward')}><ChevronDown size={16} />背面へ</button>
              </div>

              <button className="btn btn--danger btn-full mt-10 btn--icon-flex" onClick={deleteSelected}><Trash2 size={18} />選択画像削除</button>
              <button className="btn btn--primary btn-full btn--icon-flex" onClick={download}><Download size={18} />ダウンロード</button>
              <button className="btn btn--success btn-full btn--icon-flex" onClick={saveToGallery}><FolderPlus size={18} />共有ギャラリーに保存</button>
            </div>

            <div className="slider-group">
              <label>ガイドラインの太さ</label>
              <input 
                type="range" 
                min={GUIDE_THICKNESS_MIN} 
                max={GUIDE_THICKNESS_MAX} 
                value={guideThickness}
                onChange={e => setGuideThickness(parseInt(e.target.value, 10))}
                style={{ '--thumb-percent': `${((guideThickness - GUIDE_THICKNESS_MIN) / (GUIDE_THICKNESS_MAX - GUIDE_THICKNESS_MIN)) * 100}%` }}
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

/**
 * キャンバスにグリッド線（マス目）を描画します。
 * @param {Canvas} canvas Fabric Canvasインスタンス
 * @param {CanvasRenderingContext2D} ctx キャンバスコンテキスト
 */
function drawGrid(canvas, ctx) {
  if (canvas.isExporting || !ctx) return;
  ctx.save();
  
  const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
  
  const zoom = canvas.getZoom();
  const width = canvas.getWidth();
  const height = canvas.getHeight();
  
  const minX = -vpt[4] / zoom;
  const minY = -vpt[5] / zoom;
  const maxX = (width - vpt[4]) / zoom;
  const maxY = (height - vpt[5]) / zoom;
  
  const targetScreenSize = COMBINE_CONFIG.TARGET_SCREEN_SIZE;

  const rawGridSize = targetScreenSize / zoom;
  const exponent = Math.floor(Math.log10(rawGridSize));
  const base = 10 ** exponent;
  const ratio = rawGridSize / base;

  const gridSize = ratio < 1.5 ? base
                 : ratio < 3.5 ? 2 * base
                 : ratio < 7.5 ? 5 * base
                 : 10 * base;
  
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1 / zoom;
  
  const startX = Math.floor(minX / gridSize) * gridSize;
  ctx.beginPath();
  for (let x = startX; x <= maxX; x += gridSize) {
    ctx.moveTo(x, minY);
    ctx.lineTo(x, maxY);
  }
  
  const startY = Math.floor(minY / gridSize) * gridSize;
  for (let y = startY; y <= maxY; y += gridSize) {
    ctx.moveTo(minX, y);
    ctx.lineTo(maxX, y);
  }
  ctx.stroke();
  ctx.restore();
}
