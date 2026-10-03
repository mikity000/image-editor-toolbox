import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Undo2, Redo2, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Trash2, Download, FolderPlus, Upload, SlidersHorizontal } from 'lucide-react';

import { Canvas, FabricImage, FabricObject } from 'fabric';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useCanvasZoomPan } from '../hooks/useCanvasZoomPan';
import { useSnappingGuides } from '../hooks/useSnappingGuides';
import { useGallery } from '../../gallery/context/GalleryContext';
import { useToast } from '../../../shared/context/ToastContext';
import SidebarTray from '../../gallery/components/SidebarTray';
import { convertToWebP } from '../../../shared/utils/webpConverter';
import { getSequentialName, fileToDataUrl, generateUniqueId } from '../../../shared/utils/imageUtils';
import { isMobileDevice } from '../../../shared/utils/deviceUtils';
import { COMBINE_CONFIG, IMAGE_CONFIG } from '../../../shared/constants/Constants';
import { GalleryImage } from '../../gallery/types/gallery';
import { Size } from '../../../shared/types/common';
import { TrayItemData } from '../../../shared/types/ui';

export default function CombinerComponent() {
  const [imageList, setImageList] = useState<FabricObject[]>([]);
  const [isCanvasListOpen, setIsCanvasListOpen] = useState<boolean>(true);
  const [mobileTab, setMobileTab] = useState<'canvas' | 'list' | 'gallery'>('canvas');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [guideThickness, setGuideThickness] = useState<number>(COMBINE_CONFIG.GUIDE_THICKNESS_DEFAULT);
  const isMobile = isMobileDevice();

  const { galleryImages, addImages, removeImage, renameImage, isGalleryOpen, setIsGalleryOpen } = useGallery();
  const { toast } = useToast();

  const galleryItems: TrayItemData[] = useMemo(() => {
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
  const addImageFromGallery = useCallback((image: GalleryImage) => {
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
      setMobileTab('canvas');
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
    canvas.on('before:render', (opt: any) => drawGrid(canvas, opt.ctx));

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
  const uploadImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        return new Promise<void>((resolve) => {
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
  const deleteCanvasImages = useCallback((ids: string[]) => {
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
  const renameCanvasImage = useCallback((id: string, newName: string) => {
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
  const adjustLayer = useCallback((action: 'front' | 'back' | 'forward' | 'backward') => {
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
  const getExportDataURLPng = useCallback((): string | null => {
    if (!fabricCanvas) return null;
    const imageObjects = fabricCanvas.getObjects().filter(o => !o.isGuide);
    if (!imageObjects.length) return null;

    const originalVpt = [...(fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0])] as [number, number, number, number, number, number];
    fabricCanvas.discardActiveObject();
    fabricCanvas.isExporting = true;

    try {
      fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      imageObjects.forEach(obj => {
        const l = obj.left ?? 0;
        const t = obj.top ?? 0;
        const w = obj.getScaledWidth();
        const h = obj.getScaledHeight();
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
        const el = (obj as any)._element;
        if (el) {
          const origW = el.naturalWidth || el.width || 0;
          const origH = el.naturalHeight || el.height || 0;
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
      toast.error('画像のダウンロードに失敗しました。');
    }
  }, [getExportDataURLPng, toast]);

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
      toast.error('ギャラリーへの保存に失敗しました。');
    }
  }, [getExportDataURLPng, galleryImages, addImages, toast]);

  // 画像一覧アイテムをクリックしてズーム・フォーカス
  const clickImageList = useCallback((imgObj: any) => {
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
    setMobileTab('canvas');
  }, [fabricCanvas]);

  const normalizedCanvasItems: TrayItemData[] = useMemo(() => {
    return imageList.map((imgObj) => {
      if (!imgObj.id) {
        imgObj.id = generateUniqueId('canvas-img');
      }
      return {
        id: imgObj.id,
        name: imgObj.fileName || '名称未設定',
        dataUrl: imgObj.origSrc || '',
        rawItem: imgObj
      };
    });
  }, [imageList]);

  const { GUIDE_THICKNESS_MIN, GUIDE_THICKNESS_MAX } = COMBINE_CONFIG;

  return (
    <div className={`editor-container combiner-container mobile-view-${mobileTab}`}>
      {/* モバイル専用セグメントタブバー */}
      <div className="mobile-combiner-tabs" role="tablist" aria-label="表示切り替え">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'canvas'}
          className={`mobile-combiner-tab ${mobileTab === 'canvas' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('canvas')}
        >
          <span>キャンバス</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'list'}
          className={`mobile-combiner-tab ${mobileTab === 'list' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('list')}
        >
          <span>一覧</span>
          {normalizedCanvasItems.length > 0 && <span className="mobile-tab-count">({normalizedCanvasItems.length})</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'gallery'}
          className={`mobile-combiner-tab ${mobileTab === 'gallery' ? 'is-active' : ''}`}
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
            {imageList.length === 0 && (
              <div className="empty-placeholder-wrapper combiner-empty-overlay">
                <div className="empty-placeholder-card">
                  <Upload size={48} className="empty-placeholder-icon" />
                  <h3>結合する画像を追加してください</h3>
                  <p>複数枚の画像を選択してキャンバスに配置できます。</p>
                  <label className="btn btn--primary btn--icon-flex empty-placeholder-upload-btn">
                    <Upload size={18} />
                    画像を選択
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      style={{ display: 'none' }}
                      onClick={e => { (e.target as HTMLInputElement).value = ''; }} 
                      onChange={uploadImage} 
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* モバイル用クイックアクションバー＆サブバー */}
          <div className="mobile-combiner-quickbar-container">
            <div className="mobile-combiner-quickbar">
              <label className="btn quick-btn quick-upload-label" title="画像を追加">
                <Upload size={18} />
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  style={{ display: 'none' }}
                  onClick={e => { (e.target as HTMLInputElement).value = ''; }} 
                  onChange={uploadImage} 
                />
              </label>
              <div className="quickbar-divider" />
              <button 
                type="button" 
                className="btn quick-btn" 
                onClick={() => adjustLayer('front')} 
                title="最前面へ"
              >
                <ChevronsUp size={18} />
              </button>
              <button 
                type="button" 
                className="btn quick-btn" 
                onClick={() => adjustLayer('back')} 
                title="最背面へ"
              >
                <ChevronsDown size={18} />
              </button>
              <button 
                type="button" 
                className="btn quick-btn" 
                onClick={() => adjustLayer('forward')} 
                title="前面へ"
              >
                <ChevronUp size={18} />
              </button>
              <button 
                type="button" 
                className="btn quick-btn" 
                onClick={() => adjustLayer('backward')} 
                title="背面へ"
              >
                <ChevronDown size={18} />
              </button>
              <div className="quickbar-divider" />
              <button 
                type="button" 
                onClick={undo} 
                className="btn quick-btn" 
                title="元に戻す"
              >
                <Undo2 size={18} />
              </button>
              <button 
                type="button" 
                onClick={redo} 
                className="btn quick-btn" 
                title="やり直す"
              >
                <Redo2 size={18} />
              </button>
              <button 
                type="button" 
                onClick={deleteSelected} 
                className="btn quick-btn btn--danger" 
                title="選択画像を削除"
              >
                <Trash2 size={18} />
              </button>
              <div className="quickbar-divider" />
              <button 
                type="button" 
                onClick={download} 
                className="btn quick-btn btn--primary" 
                title="結合画像をダウンロード"
              >
                <Download size={18} />
              </button>
              <button 
                type="button" 
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} 
                className={`btn quick-btn ${isMoreMenuOpen ? 'is-selected' : ''}`} 
                title="追加設定・保存メニュー"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>

            {/* 2行目折りたたみサブバー */}
            {isMoreMenuOpen && (
              <div className="mobile-combiner-subbar">
                <button
                  type="button"
                  onClick={saveToGallery}
                  className="btn btn--sm btn--success btn--icon-flex"
                >
                  <FolderPlus size={15} /> 共有ギャラリー保存
                </button>
                <div className="mobile-combiner-slider-row">
                  <span className="mobile-slider-label">ガイド: {guideThickness}px</span>
                  <input 
                    type="range" 
                    min={GUIDE_THICKNESS_MIN} 
                    max={GUIDE_THICKNESS_MAX} 
                    value={guideThickness}
                    onChange={e => setGuideThickness(parseInt(e.target.value, 10))}
                    className="mobile-subbar-slider"
                  />
                </div>
                {selectedSize && (
                  <span className="mobile-size-badge">
                    {`${selectedSize.width.toFixed(0)} × ${selectedSize.height.toFixed(0)} px`}
                  </span>
                )}
              </div>
            )}
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
                onClick={e => { (e.target as HTMLInputElement).value = ''; }} 
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
                style={{ '--thumb-percent': `${((guideThickness - GUIDE_THICKNESS_MIN) / (GUIDE_THICKNESS_MAX - GUIDE_THICKNESS_MIN)) * 100}%` } as React.CSSProperties}
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
 * @param canvas Fabric Canvasインスタンス
 * @param ctx キャンバスコンテキスト
 */
function drawGrid(canvas: Canvas, ctx: CanvasRenderingContext2D | null | undefined) {
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
