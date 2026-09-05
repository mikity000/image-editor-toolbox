import React, { useState, useCallback, useRef, useContext, useMemo, memo } from 'react';
import { Trash2, RotateCcw, FileText, Download } from 'lucide-react';

import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { compressImage, fileToDataUrl } from '../utils/imageUtils';
import { isMobileDevice } from '../utils/deviceUtils';
import { usePdfGenerator } from '../hooks/usePdfGenerator';
import { usePdfExtractor } from '../hooks/usePdfExtractor';
import { PDF_CONFIG } from '../constants/Constants';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import SidebarTray from './SidebarTray';
import { GalleryContext } from '../context/GalleryContext';
import { convertToWebP } from '../utils/webpConverter';
import { GalleryImage } from '../types/gallery';

export interface PdfPageItem {
  id: string;
  name: string;
  dataUrl: string;
  file?: File;
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
    return galleryImages.map(img => ({
      id: img.id,
      name: img.name,
      dataUrl: img.dataUrl,
      rawItem: img
    }));
  }, [galleryImages]);

  const [images, setImages] = useState<PdfPageItem[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragStartRect, setDragStartRect] = useState<{ width: number; height: number } | null>(null);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const { generatePdf, isProcessing, progress: pdfProgress } = usePdfGenerator();
  const { extractImagesFromPdfs, isExtracting, extractProgress } = usePdfExtractor();

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
  }, []);

  const isMobile = isMobileDevice();
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const sensors = useSensors(isMobile ? touchSensor : pointerSensor);

  // ファイル入力ハンドラ（画像・PDF両対応）
  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    // PDFファイルからの画像抽出
    if (pdfFiles.length > 0) {
      await extractImagesFromPdfs(pdfFiles, (extractedImages) => {
        setImages(prev => [...prev, ...extractedImages]);
      });
    }

    // 画像ファイルの処理（WebP変換による高品質・高圧縮化 + JPEG化）
    if (imageFiles.length > 0) {
      setIsUploading(true);
      const totalFiles = imageFiles.length;
      let completed = 0;

      const compressPromises = imageFiles.map(async (file) => {
        try {
          // 1. ファイルをDataURLに読み込む
          const originalDataUrl = await fileToDataUrl(file);

          // 2. WebP（品質85）に変換（高品質・最小サイズ化）
          const webpDataUrl = await convertToWebP(originalDataUrl, {
            quality: PDF_CONFIG.DEFAULT_WEBP_QUALITY
          });

          // 3. PDF埋め込み用にBlob経由でJPEG化
          const res = await fetch(webpDataUrl);
          const blob = await res.blob();
          const webpFile = new File([blob], file.name, { type: 'image/webp' });
          const finalJpegDataUrl = await compressImage(webpFile);

          return {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            file,
            name: file.name,
            dataUrl: finalJpegDataUrl,
          };
        } finally {
          completed++;
          setUploadProgress(Math.round((completed / totalFiles) * 100));
        }
      });

      const newImages = await Promise.all(compressPromises);
      setImages(prev => [...prev, ...newImages]);
      setIsUploading(false);
      setUploadProgress(0);
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

  // 画像選択（単一・Ctrl/Cmd複数選択）
  const selectImage = useCallback((id: string, event?: React.MouseEvent) => {
    const isMultiSelect = event && (event.ctrlKey || event.metaKey);
    setSelectedImages((prevSelected) => {
      if (isMultiSelect) {
        const newSelected = new Set(prevSelected);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        return newSelected;
      }
      return new Set([id]);
    });
  }, []);

  const deleteSelected = useCallback(() => {
    setImages(prev => prev.filter((i) => !selectedImages.has(i.id)));
    setSelectedImages(new Set());
  }, [selectedImages]);

  const resetImages = useCallback(() => {
    setImages([]);
    setSelectedImages(new Set());
  }, []);

  const handleGeneratePdf = useCallback(() => {
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
    } finally {
      setIsZipping(false);
    }
  }, [images]);

  const isAnyLoading = isUploading || isProcessing || isExtracting || isZipping;
  const currentProgress = isUploading ? uploadProgress : (isExtracting ? extractProgress : pdfProgress);
  const loadingText = isUploading 
    ? '画像をアップロード中...' 
    : (isExtracting 
        ? 'PDFから画像を抽出中...' 
        : (isZipping 
            ? '画像をZIPに圧縮中...' 
            : 'PDFを生成中...'));

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
    <div className="editor-container">
      {/* ローディングオーバーレイ */}
      {isAnyLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <p>{loadingText}</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${currentProgress}%` }}></div>
            </div>
            <p>{currentProgress}%</p>
          </div>
        </div>
      )}

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
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragStart={dragStart}
            onDragOver={dragOver} 
            onDragEnd={dragEnd} 
            modifiers={[restrictToFirstScrollableAncestor]}
          >
            <SortableContext items={images.map(img => img.id)}>
              <div className="image-list-container">
                {images.length > 0 && (
                  <div className="image-list">
                    {images.map((image, index) => (
                      <SortableImagePreview 
                        key={image.id} 
                        image={image} 
                        images={images} 
                        index={index}
                        isSelected={selectedImages.has(image.id)} 
                        onSelect={selectImage}
                        activeId={activeId} 
                        selectedImages={selectedImages}
                      />
                    ))}
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="editor-sidebar">
          <div className="sidebar-sticky-content">
            {/* ファイル入力セクション */}
            <div className="file-input">
              <input 
                type="file" 
                accept="image/*,application/pdf" 
                multiple 
                className="file-input__control" 
                disabled={isAnyLoading}
                onClick={e => { (e.target as HTMLInputElement).value = ''; }} 
                onChange={handleFileInput}
              />
            </div>

            {/* 操作ボタン群 */}
            <div className="button-group sidebar-buttons">
              <button 
                onClick={deleteSelected} 
                disabled={selectedImages.size === 0 || isAnyLoading} 
                className="btn btn--danger btn-full btn--icon-flex"
              >
                <Trash2 size={18} />選択画像削除
              </button>
              <button 
                onClick={resetImages} 
                disabled={images.length === 0 || isAnyLoading} 
                className="btn btn--danger btn-full btn--icon-flex"
              >
                <RotateCcw size={18} />リセット
              </button>
              <button 
                onClick={handleGeneratePdf} 
                disabled={images.length === 0 || isAnyLoading} 
                className="btn btn--primary btn-full btn--icon-flex"
              >
                <FileText size={18} />{isProcessing ? `PDF生成中... (${pdfProgress}%)` : 'PDFを生成'}
              </button>
              <button 
                onClick={downloadAllImages} 
                disabled={images.length === 0 || isAnyLoading} 
                className="btn btn--primary btn-full btn--icon-flex"
              >
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

const SortableImagePreview = memo(function SortableImagePreview({
  image,
  images,
  index,
  isSelected,
  onSelect,
  activeId,
  selectedImages,
}: SortableImagePreviewProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  
  const showPlaceholder = isDragging || (activeId !== null && selectedImages.has(activeId) && isSelected);

  const wrapperStyle: React.CSSProperties = {
    transform: showPlaceholder ? undefined : CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      {...attributes}
      {...listeners}
      id={`preview-${image.id}`}
    >
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
    <div className={`image-preview-item ${isSelected ? 'selected' : ''}`} onClick={(e) => onSelect(image.id, e)}>
      <img src={image.dataUrl} alt={image.name} className="thumbnail" />
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
          <div 
            key={selId} 
            className="image-preview-item selected stack"
            style={{ zIndex: -(i + 1), transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 5}px)` }}
          >
            <img src={target.dataUrl} alt="" className="thumbnail" />
          </div>
        );
      })}
    </>
  );
});
