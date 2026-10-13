import React, { useState, useCallback, useRef, useContext, useMemo, memo } from 'react';
import { Trash2, RotateCcw, FileText, Download, Eye, Upload, SlidersHorizontal, Loader2 } from 'lucide-react';
import PdfPreviewModal from './PdfPreviewModal';

import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { compressImage, fileToDataUrl } from '../../../shared/utils/imageUtils';
import { isMobileDevice } from '../../../shared/utils/deviceUtils';
import { usePdfGenerator } from '../hooks/usePdfGenerator';
import { usePdfExtractor } from '../hooks/usePdfExtractor';
import { PDF_CONFIG } from '../../../shared/constants/Constants';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import SidebarTray from '../../gallery/components/SidebarTray';
import { GalleryContext } from '../../gallery/context/GalleryContext';
import { convertToWebP } from '../../../shared/utils/webpConverter';
import { GalleryImage } from '../../gallery/types/gallery';
import { useToast } from '../../../shared/context/ToastContext';

export interface PdfPageItem {
  id: string;
  name: string;
  dataUrl: string;
  file?: File;
  isLoading?: boolean;
}

// 複数アイテムをまとめて移動する純粋関数
function arrayMoveMultiple(
  items: PdfPageItem[],
  selectedIds: Set<string>,
  overId: string,
  oldIndex: number,
  newIndex: number
): PdfPageItem[] {
  const others = items.filter(item => !selectedIds.has(item.id));
  const selectedItems = items.filter(item => selectedIds.has(item.id));
  const overIndexInOthers = others.findIndex(item => item.id === overId);
  const insertionIndex = oldIndex < newIndex ? overIndexInOthers + 1 : overIndexInOthers;
  const result = [...others];
  result.splice(insertionIndex, 0, ...selectedItems);
  return result;
}

export default function PdfComponent() {
  const { galleryImages, removeImage, renameImage, isGalleryOpen, setIsGalleryOpen } = useContext(GalleryContext);
  
  const galleryItems = useMemo(() => {
    return galleryImages.map(img => ({ id: img.id, name: img.name, dataUrl: img.dataUrl, rawItem: img }));
  }, [galleryImages]);

  const [images, setImages] = useState<PdfPageItem[]>([]);
  const [mobileTab, setMobileTab] = useState<'list' | 'gallery'>('list');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const baseSelectedRef = useRef<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragStartRect, setDragStartRect] = useState<{ width: number; height: number } | null>(null);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const { generatePdf, isProcessing, progress: pdfProgress } = usePdfGenerator();
  const { extractImagesFromPdfs, isExtracting, extractProgress } = usePdfExtractor();
  const { toast } = useToast();

  // ギャラリーからの画像追加
  const addImageFromGallery = useCallback(async (image: GalleryImage) => {
    let dataUrl = image.dataUrl;

    if (!dataUrl.startsWith('data:image/jpeg') && !dataUrl.startsWith('data:image/jpg')) {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], image.name, { type: blob.type || 'image/webp' });
        dataUrl = await compressImage(file);
      } catch (err) {
        console.error('ギャラリー画像のJPEG変換に失敗しました:', err);
      }
    }

    const newImage: PdfPageItem = {
      id: `pdf-page-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: image.name,
      dataUrl
    };
    setImages(prev => [...prev, newImage]);
    setMobileTab('list');
  }, []);

  const isMobile = isMobileDevice();
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const sensors = useSensors(isMobile ? touchSensor : pointerSensor);

  // ファイル入力ハンドラ（画像・PDF両対応、リアルタイム順次表示対応）
  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    // PDFファイルからの画像抽出（ページ単位でリアルタイム順次追加）
    if (pdfFiles.length > 0) {
      await extractImagesFromPdfs(
        pdfFiles,
        undefined,
        (singleImage) => {
          setImages(prev => [...prev, singleImage]);
        }
      );
    }

    // 画像ファイルの処理（スケルトンを即時配置し、変換完了したものからリアルタイム反映）
    if (imageFiles.length > 0) {
      setIsUploading(true);
      setUploadProgress(0);
      const totalFiles = imageFiles.length;
      let completed = 0;

      // ファイル選択順を維持するため、プレースホルダーを先行追加
      const placeholders: PdfPageItem[] = imageFiles.map((file, idx) => ({
        id: `img-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        dataUrl: '',
        file,
        isLoading: true,
      }));

      setImages(prev => [...prev, ...placeholders]);

      try {
        await Promise.all(
          imageFiles.map(async (file, idx) => {
            const targetId = placeholders[idx].id;
            try {
              // 1. ファイルをDataURLに読み込む
              const originalDataUrl = await fileToDataUrl(file);

              // 2. WebP（品質85）に変換（高品質・最小サイズ化）
              const webpDataUrl = await convertToWebP(originalDataUrl, {
                quality: PDF_CONFIG.DEFAULT_WEBP_QUALITY,
              });

              // 3. PDF埋め込み用にBlob経由でJPEG化
              const res = await fetch(webpDataUrl);
              const blob = await res.blob();
              const webpFile = new File([blob], file.name, { type: 'image/webp' });
              const finalJpegDataUrl = await compressImage(webpFile);

              // 変換が完了した画像からリアルタイムにプレビュー表示へ更新
              setImages(prev =>
                prev.map(item =>
                  item.id === targetId
                    ? { ...item, dataUrl: finalJpegDataUrl, isLoading: false }
                    : item
                )
              );
            } catch (err) {
              console.error(`画像処理エラー (${file.name}):`, err);
              // 失敗時は該当プレースホルダーを除去
              setImages(prev => prev.filter(item => item.id !== targetId));
            } finally {
              completed++;
              setUploadProgress(Math.round((completed / totalFiles) * 100));
            }
          })
        );
      } catch (err: any) {
        console.error('画像処理中にエラーが発生しました:', err);
        toast.error(err?.message || '画像の処理中にエラーが発生しました。');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        event.target.value = '';
      }
    }
  };

  // ドラッグ開始
  const dragStart = useCallback((e: DragStartEvent) => {
    const { active } = e;
    const activeIdStr = String(active.id);
    setActiveId(activeIdStr);
    document.body.classList.add('is-dragging');

    const element = document.getElementById(`preview-${activeIdStr}`);
    if (element) {
      const rect = element.getBoundingClientRect();
      setDragStartRect({
        width: rect.width,
        height: rect.height
      });

      const activatorEvent = e.activatorEvent as MouseEvent | TouchEvent | undefined;
      if (activatorEvent) {
        const clientX = 'clientX' in activatorEvent 
          ? activatorEvent.clientX 
          : (activatorEvent.touches?.[0]?.clientX);
        const clientY = 'clientY' in activatorEvent 
          ? activatorEvent.clientY 
          : (activatorEvent.touches?.[0]?.clientY);

        if (clientX !== undefined && clientY !== undefined) {
          dragStartOffsetRef.current = {
            x: clientX - rect.left,
            y: clientY - rect.top
          };
          
          requestAnimationFrame(() => {
            if (dragPreviewRef.current) {
              const top = clientY - dragStartOffsetRef.current.y;
              const left = clientX - dragStartOffsetRef.current.x;
              dragPreviewRef.current.style.top = `${top}px`;
              dragPreviewRef.current.style.left = `${left}px`;
            }
          });
        }
      }
    }

    const handlePointerMove = (event: PointerEvent | TouchEvent) => {
      const clientX = 'clientX' in event ? event.clientX : (event.touches?.[0]?.clientX);
      const clientY = 'clientY' in event ? event.clientY : (event.touches?.[0]?.clientY);
      if (clientX !== undefined && clientY !== undefined && dragPreviewRef.current) {
        const top = clientY - dragStartOffsetRef.current.y;
        const left = clientX - dragStartOffsetRef.current.x;
        dragPreviewRef.current.style.top = `${top}px`;
        dragPreviewRef.current.style.left = `${left}px`;
      }
    };

    window.addEventListener('pointermove', handlePointerMove as EventListener);
    window.addEventListener('touchmove', handlePointerMove as EventListener, { passive: true });

    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove as EventListener);
      window.removeEventListener('touchmove', handlePointerMove as EventListener);
    };
  }, []);

  // ドラッグ中のリアルタイム並び替え
  const dragOver = useCallback((e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const isActiveSelected = selectedImages.has(activeIdStr);
    if (isActiveSelected && selectedImages.has(overIdStr)) return;

    setImages((items) => {
      const oldIndex = items.findIndex((item) => item.id === activeIdStr);
      const newIndex = items.findIndex((item) => item.id === overIdStr);
      
      if (oldIndex === -1 || newIndex === -1) return items;

      return isActiveSelected
        ? arrayMoveMultiple(items, selectedImages, overIdStr, oldIndex, newIndex)
        : arrayMove(items, oldIndex, newIndex);
    });
  }, [selectedImages]);

  // ドラッグ終了
  const dragEnd = useCallback(() => {
    setActiveId(null);
    setDragStartRect(null);
    dragStartOffsetRef.current = { x: 0, y: 0 };
    document.body.classList.remove('is-dragging');
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
  }, []);

  // 画像選択（単一・Ctrl/Cmd複数選択・Shift範囲選択・スマホトグル選択）
  const selectImage = useCallback((id: string, event?: React.MouseEvent) => {
    const isMobileViewport = typeof window !== 'undefined' && (window.innerWidth <= 767 || isMobileDevice());

    if (isMobileViewport || (event && (event.ctrlKey || event.metaKey))) {
      // スマホ環境またはCtrl/Cmd+クリック: 選択のトグル
      setSelectedImages((prevSelected) => {
        const newSelected = new Set(prevSelected);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        baseSelectedRef.current = newSelected;
        return newSelected;
      });
      setLastSelectedId(id);
    } else if (event?.shiftKey && lastSelectedId) {
      // PC: Shift+クリック: 起点から現在位置までの範囲選択（直前のベース選択を保持して合算）
      const allIds = images.map(img => img.id);
      const lastIndex = allIds.indexOf(lastSelectedId);
      const currentIndex = allIds.indexOf(id);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = allIds.slice(start, end + 1);

        // baseSelectedRef（Ctrl選択等で確定していた選択状態）に範囲アイテムを追加
        const newSelected = new Set(baseSelectedRef.current);
        rangeIds.forEach(rangeId => newSelected.add(rangeId));
        setSelectedImages(newSelected);
      } else {
        const newSelected = new Set([id]);
        setSelectedImages(newSelected);
        setLastSelectedId(id);
        baseSelectedRef.current = newSelected;
      }
    } else {
      // PC: 通常クリック: 単一選択
      const newSelected = new Set([id]);
      setSelectedImages(newSelected);
      setLastSelectedId(id);
      baseSelectedRef.current = newSelected;
    }
  }, [images, lastSelectedId]);

  const deleteSelected = useCallback(() => {
    setImages(prev => prev.filter((i) => !selectedImages.has(i.id)));
    setSelectedImages(new Set());
    setLastSelectedId(null);
    baseSelectedRef.current = new Set();
  }, [selectedImages]);

  const resetImages = useCallback(() => {
    setImages([]);
    setSelectedImages(new Set());
    setLastSelectedId(null);
    baseSelectedRef.current = new Set();
  }, []);

  const handleGeneratePdf = useCallback(() => {
    generatePdf(images);
  }, [generatePdf, images]);

  // プレビューモーダルを直接オープン（事前PDF生成を待たずに即時表示）
  const handleOpenPreview = useCallback(() => {
    if (images.length === 0) return;
    setIsPreviewOpen(true);
  }, [images.length]);

  // プレビューモーダルからの直接ダウンロード
  const handleDownloadFromPreview = useCallback(() => {
    generatePdf(images);
  }, [generatePdf, images]);

  // 画像一括ZIPダウンロード（並列フェッチによる高速化）
  const downloadAllImages = useCallback(async () => {
    if (images.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      await Promise.all(
        images.map(async (image) => {
          const res = await fetch(image.dataUrl);
          const blob = await res.blob();
          zip.file(image.name, blob);
        })
      );

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'images.zip');
    } catch (err) {
      console.error('画像の一括ダウンロードに失敗しました:', err);
      toast.error('画像の一括ダウンロードに失敗しました。');
    } finally {
      setIsZipping(false);
    }
  }, [images, toast]);

  const isInlineLoading = isUploading || isExtracting;
  const inlineProgress = isUploading ? uploadProgress : extractProgress;
  const inlineLoadingText = isUploading ? '画像を変換・読み込み中...' : 'PDFから画像を抽出中...';

  const isModalLoading = isProcessing || isZipping;
  const modalLoadingProgress = pdfProgress;
  const modalLoadingText = isZipping ? '画像をZIPに圧縮中...' : 'PDFを生成中...';

  const hasLoadingImages = images.some(img => img.isLoading);
  const isAnyLoading = isModalLoading || isInlineLoading || hasLoadingImages;

  const dragActiveItem = useMemo(() => images.find(img => img.id === activeId), [images, activeId]);
  const dragActiveIndex = useMemo(() => images.findIndex(img => img.id === activeId), [images, activeId]);
  const isGroupDragActive = Boolean(activeId && selectedImages.has(activeId) && selectedImages.size > 1);

  const dragPreviewStyle = useMemo((): React.CSSProperties | null => {
    if (!dragStartRect) return null;
    return {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: dragStartRect.width,
      height: dragStartRect.height,
      pointerEvents: 'none',
      zIndex: 9999,
    };
  }, [dragStartRect]);

  return (
    <div className={`editor-container pdf-container mobile-view-${mobileTab}`}>
      {/* 重い生成・圧縮処理時のモーダルローディングオーバーレイ */}
      {isModalLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <p>{modalLoadingText}</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${modalLoadingProgress}%` }}></div>
            </div>
            <p>{modalLoadingProgress}%</p>
          </div>
        </div>
      )}

      {/* モバイル専用セグメントタブバー */}
      <div className="mobile-pdf-tabs" role="tablist" aria-label="表示切り替え">
        <button type="button" role="tab" aria-selected={mobileTab === 'list'} className={`mobile-pdf-tab ${mobileTab === 'list' ? 'is-active' : ''}`} onClick={() => setMobileTab('list')}>
          <span>ページ一覧</span>
          {images.length > 0 && <span className="mobile-tab-count">({images.length})</span>}
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === 'gallery'} className={`mobile-pdf-tab ${mobileTab === 'gallery' ? 'is-active' : ''}`} onClick={() => setMobileTab('gallery')}>
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
        </div>
        
        <div className="editor-main pdf-main-content">
          {/* インライン進捗バナー（プレビューのリアルタイム表示を遮らない進捗バー） */}
          {isInlineLoading && (
            <div className="pdf-inline-progress-banner" role="status" aria-live="polite">
              <div className="pdf-inline-progress-info">
                <Loader2 size={16} />
                <span>{inlineLoadingText} ({inlineProgress}%)</span>
              </div>
              <div className="pdf-inline-progress-bar-bg">
                <div className="pdf-inline-progress-bar-fill" style={{ width: `${inlineProgress}%` }}></div>
              </div>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart} onDragOver={dragOver} onDragEnd={dragEnd} modifiers={[restrictToFirstScrollableAncestor]}>
            <SortableContext items={images.map(img => img.id)}>
              <div className="image-list-container">
                {images.length > 0 ? (
                  <div className="image-list">
                    {images.map((image, index) => (
                      <SortableImagePreview key={image.id} image={image} images={images} index={index} isSelected={selectedImages.has(image.id)} onSelect={selectImage} activeId={activeId} selectedImages={selectedImages} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-placeholder-wrapper pdf-empty-placeholder">
                    <div className="empty-placeholder-card">
                      <Upload size={48} className="empty-placeholder-icon" />
                      <h3>画像またはPDFファイルを読み込んでください</h3>
                      <p>JPEG / PNG 画像や、既存のPDFファイルを追加できます。</p>
                      <label className="btn btn--primary btn--icon-flex empty-placeholder-upload-btn">
                        <Upload size={18} />
                        ファイルを選択
                        <input type="file" accept="image/*,application/pdf" multiple disabled={isAnyLoading} onClick={e => { (e.target as HTMLInputElement).value = ''; }} onChange={handleFileInput} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          {/* モバイル用固定アクションバー＆サブバー */}
          <div className="mobile-pdf-actionbar-container">
            <div className="mobile-pdf-actionbar">
              <label className="btn quick-btn quick-upload-label" title="画像・PDFを追加">
                <Upload size={18} />
                <input type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} disabled={isAnyLoading} onClick={e => { (e.target as HTMLInputElement).value = ''; }} onChange={handleFileInput} />
              </label>
              <button type="button" onClick={handleOpenPreview} disabled={images.length === 0 || isAnyLoading} className="btn quick-btn" title="プレビュー">
                <Eye size={18} />
              </button>
              <button type="button" onClick={handleGeneratePdf} disabled={images.length === 0 || isAnyLoading} className={`btn quick-btn btn--primary mobile-pdf-generate-btn ${isProcessing ? 'is-processing' : ''}`} title="PDF生成" aria-label="PDF生成">
                {isProcessing ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{pdfProgress}%</span>
                ) : (
                  <FileText size={18} />
                )}
              </button>
              <button type="button" onClick={deleteSelected} disabled={selectedImages.size === 0 || isAnyLoading} className="btn quick-btn btn--danger" title="選択画像を削除">
                <Trash2 size={18} />
              </button>
              <button type="button" onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className={`btn quick-btn ${isMoreMenuOpen ? 'is-selected' : ''}`} title="その他メニュー（一括DL・リセット）">
                <SlidersHorizontal size={18} />
              </button>
            </div>

            {/* 2行目折りたたみサブバー */}
            {isMoreMenuOpen && (
              <div className="mobile-pdf-subbar">
                <button type="button" onClick={downloadAllImages} disabled={images.length === 0 || isAnyLoading} className="btn quick-btn btn--primary" title="画像を一括ダウンロード" aria-label="画像を一括ダウンロード">
                  <Download size={18} />
                </button>
                <button type="button" onClick={resetImages} disabled={images.length === 0 || isAnyLoading} className="btn quick-btn btn--danger" title="リセット" aria-label="リセット">
                  <RotateCcw size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="editor-sidebar">
          <div className="sidebar-sticky-content">
            {/* ファイル入力セクション */}
            <div className="file-input">
              <input type="file" accept="image/*,application/pdf" multiple className="file-input__control" disabled={isAnyLoading} onClick={e => { (e.target as HTMLInputElement).value = ''; }} onChange={handleFileInput} />
            </div>

            {/* 操作ボタン群 */}
            <div className="button-group sidebar-buttons">
              <button onClick={deleteSelected} disabled={selectedImages.size === 0 || isAnyLoading} className="btn btn--danger btn-full btn--icon-flex">
                <Trash2 size={18} />選択画像削除
              </button>
              <button onClick={resetImages} disabled={images.length === 0 || isAnyLoading} className="btn btn--danger btn-full btn--icon-flex">
                <RotateCcw size={18} />リセット
              </button>
              <button onClick={handleOpenPreview} disabled={images.length === 0 || isAnyLoading} className="btn btn--primary btn-full btn--icon-flex" title="作成予定のPDFをプレビュー">
                <Eye size={18} />PDFプレビュー
              </button>
              <button onClick={handleGeneratePdf} disabled={images.length === 0 || isAnyLoading} className="btn btn--primary btn-full btn--icon-flex">
                <FileText size={18} />{isProcessing ? `PDF生成中... (${pdfProgress}%)` : 'PDFを生成'}
              </button>
              <button onClick={downloadAllImages} disabled={images.length === 0 || isAnyLoading} className="btn btn--primary btn-full btn--icon-flex">
                <Download size={18} />{isZipping ? 'ダウンロード準備中...' : '画像を一括DL'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* カスタムドラッグプレビュー */}
      {activeId && dragActiveItem && dragPreviewStyle && (
        <div ref={dragPreviewRef} style={dragPreviewStyle}>
          <ImagePreview image={dragActiveItem} index={dragActiveIndex} isSelected={selectedImages.has(activeId)} onSelect={() => {}} />
          <DraggedItemStack isDragging={true} isGroupDragActive={isGroupDragActive} selectedImages={selectedImages} id={activeId} images={images} />
          {isGroupDragActive && <span className="count-badge">{selectedImages.size}</span>}
        </div>
      )}

      {/* PDFプレビューモーダル（画像を直接即時プレビュー表示） */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        images={images}
        onDownload={handleDownloadFromPreview}
        isDownloading={isProcessing}
      />
    </div>
  );
}

interface SortableImagePreviewProps {
  image: PdfPageItem;
  images: PdfPageItem[];
  index: number;
  isSelected: boolean;
  onSelect: (id: string, event?: React.MouseEvent) => void;
  activeId: string | null;
  selectedImages: Set<string>;
}

const SortableImagePreview = memo(function SortableImagePreview({ image, images, index, isSelected, onSelect, activeId, selectedImages }: SortableImagePreviewProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: image.id,
    disabled: image.isLoading,
  });
  
  const showPlaceholder = isDragging || (activeId !== null && selectedImages.has(activeId) && isSelected);

  const wrapperStyle: React.CSSProperties = {
    transform: showPlaceholder ? undefined : CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle} {...attributes} {...listeners} id={`preview-${image.id}`}>
      <div style={{ visibility: showPlaceholder ? 'hidden' : 'visible' }}>
        <ImagePreview image={image} index={index} isSelected={isSelected} onSelect={onSelect} />
      </div>
      {showPlaceholder && (
        <div className="image-preview-item placeholder-card">
          <div className="thumbnail-placeholder"></div>
        </div>
      )}
    </div>
  );
});

interface ImagePreviewProps {
  image: PdfPageItem;
  index: number;
  isSelected: boolean;
  onSelect: (id: string, event?: React.MouseEvent) => void;
}

const ImagePreview = memo(function ImagePreview({ image, index, isSelected, onSelect }: ImagePreviewProps) {
  return (
    <div 
      className={`image-preview-item ${isSelected ? 'selected' : ''} ${image.isLoading ? 'loading-card' : ''}`} 
      onClick={(e) => !image.isLoading && onSelect(image.id, e)}
    >
      {image.isLoading ? (
        <div className="thumbnail-skeleton">
          <Loader2 size={24} />
          <span className="skeleton-label">読み込み中...</span>
        </div>
      ) : (
        <img src={image.dataUrl} alt={image.name} className="thumbnail" />
      )}
      <div className="image-info image-info--no-margin">
        <p className="file-name">{image.name}</p>
        <p className="page-number">{index + 1} ページ</p>
      </div>
    </div>
  );
});

interface DraggedItemStackProps {
  isDragging: boolean;
  isGroupDragActive: boolean;
  selectedImages: Set<string>;
  id: string;
  images: PdfPageItem[];
}

// 複数ドラッグ時のスタック幻影
const DraggedItemStack = memo(function DraggedItemStack({
  isDragging,
  isGroupDragActive,
  selectedImages,
  id,
  images,
}: DraggedItemStackProps) {
  if (!isDragging || !isGroupDragActive) return null;
  const otherSelectedIds = [...selectedImages].filter(selId => selId !== id).slice(0, 2);
  
  return (
    <>
      {otherSelectedIds.map((selId, i) => {
        const target = images.find(img => img.id === selId);
        if (!target) return null;
        return (
          <div key={selId} className="image-preview-item selected stack" style={{ zIndex: -(i + 1), transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 5}px)` }}>
            <img src={target.dataUrl} alt="" className="thumbnail" />
          </div>
        );
      })}
    </>
  );
});
