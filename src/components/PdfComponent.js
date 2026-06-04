import { useState, useCallback, useRef, useEffect } from 'react';
import { setupListSync } from '../syncService';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { compressImage } from '../utils';
import { usePdfGenerator } from '../hooks/usePdfGenerator';
import { usePdfExtractor } from '../hooks/usePdfExtractor';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import GalleryTray from './GalleryTray';

export default function PdfComponent() {
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [activeId, setActiveId] = useState(null); // ドラッグ中のアイテムIDを管理
  const [isUploading, setIsUploading] = useState(false); // 画像アップロード中
  const [uploadProgress, setUploadProgress] = useState(0); // アップロード進捗

  const { generatePdf, isProcessing, progress: pdfProgress } = usePdfGenerator();
  const { extractImagesFromPdfs, isExtracting, extractProgress } = usePdfExtractor();

  const addImageFromGallery = (image) => {
    const newImage = {
      id: `pdf-page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: image.name,
      dataUrl: image.dataUrl
    };
    setImages(prev => [...prev, newImage]);
  };
  // モバイル判定を navigator.userAgent とメディアクエリで判定
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
  const socketRef = useRef(null);
  const emitListRef = useRef(null);

  // @dnd-kitのドラッグイベントリスナーと、通常のonClickイベントリスナーが競合するのでドラッグの開始条件に制約を設ける
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const sensors = useSensors(isMobile ? touchSensor : pointerSensor);

  // useEffect(() => {
  //   const { socket, emitListSync } = setupListSync({
  //     url: 'http://192.000.0.0:3000',
  //     onReceive: listData => setImages(listData)
  //   });
  //   socketRef.current = socket;
  //   emitListRef.current = emitListSync;
  // }, []);

  const handleFileInput = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // PDFファイルと画像ファイルに分類
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    // PDFファイルの処理（順次抽出）
    if (pdfFiles.length > 0) {
      await extractImagesFromPdfs(pdfFiles, (extractedImages) => {
        setImages(prev => [...prev, ...extractedImages]);
      });
    }

    // 画像ファイルの処理
    if (imageFiles.length > 0) {
      setIsUploading(true);
      const totalFiles = imageFiles.length; // 総ファイル数

      // 並列に全ファイルを圧縮して Data URL に変換
      let completed = 0;
      const compressPromises = imageFiles.map((file) =>
        compressImage(file).then((dataUrl) => ({
          id: URL.createObjectURL(file),
          file,
          name: file.name,
          dataUrl,
        })).finally(() => {
          completed++;
          const progressValue = Math.round((completed / totalFiles) * 100); // 一時的な進捗
          setUploadProgress(progressValue);
        })
      );

      const newImages = await Promise.all(compressPromises);
      setImages(prev => [...prev, ...newImages]);
      //emitListRef.current?.(updated);
      setIsUploading(false);
      setUploadProgress(0); // 完了後に進捗をリセット
    }
  };

  // ドラッグ開始時の処理
  const dragStart = useCallback((e) => setActiveId(e.active.id), []);

  const dragEnd = (e) => {
    setActiveId(null); // ドラッグ終了時にactiveIdをリセット
    const { active, over } = e;
    if (active.id === over.id || selectedImages.has(over.id)) return;
    setImages((items) => {
      // 通常の「単一ドラッグ」での並び替えインデックスを計算
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      // active が選択中に含まれるかチェック
      const newList = selectedImages.has(active.id) ? arrayMoveMultiple(items, selectedImages, over.id, oldIndex, newIndex)
                                                     : arrayMove(items, oldIndex, newIndex);
      // ドラッグ順序変更を同期
      //emitListRef.current?.(newList);
      return newList;
    });
  };

  // 複数アイテムをまとめて移動するヘルパー
  function arrayMoveMultiple(items, selectedIds, overId, oldIndex, newIndex) {
    // 選択中以外のアイテムを先に残す
    const others = items.filter(item => !selectedIds.has(item.id));
    // 選択中アイテムだけを取り出す
    const selectedItems = items.filter(item => selectedIds.has(item.id));
    // others 上で overId の位置を探し、移動方向に応じて挿入位置を調整
    const overIndexInOthers = others.findIndex(item => item.id === overId);
    const insertionIndex = oldIndex < newIndex ? overIndexInOthers + 1 : overIndexInOthers;
    return others.toSpliced(insertionIndex, 0, ...selectedItems);
  }

  const selectImage = useCallback((id) => {
    setSelectedImages((prevSelected) => {
      const newSelected = new Set(prevSelected);
      newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
      return newSelected;
    });
  }, []);

  const deleteSelected = () => {
    const updated = images.filter((i) => !selectedImages.has(i.id));
    setImages(updated);
    setSelectedImages(new Set());
    //emitListRef.current?.(updated);
  };

  const resetImages = () => {
    setImages([]);
    //emitListRef.current?.([]);
    setSelectedImages(new Set());
  };

  const handleGeneratePdf = () => {
    generatePdf(images);
  };

  const [isZipping, setIsZipping] = useState(false);

  const downloadAllImages = async () => {
    if (images.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        // dataUrl から Blob データを取得
        const res = await fetch(image.dataUrl);
        const blob = await res.blob();
        zip.file(image.name, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'images.zip');
    } catch (err) {
      console.error('画像の一括ダウンロードに失敗しました:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const isAnyLoading = isUploading || isProcessing || isExtracting || isZipping;
  const currentProgress = isUploading ? uploadProgress : (isExtracting ? extractProgress : pdfProgress);
  const loadingText = isUploading ? '画像をアップロード中...' : (isExtracting ? 'PDFから画像を抽出中...' : (isZipping ? '画像をZIPに圧縮中...' : 'PDFを生成中...'));

  return (
    <div className="editor-container">
      {/* Loading Overlay */}
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

      <div className="cropper-layout">
        <div className="cropper-main">
          {/* サムネイルリスト DND コンテナ */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart}
            onDragEnd={dragEnd} modifiers={[restrictToFirstScrollableAncestor]}>
            <SortableContext items={images.map(img => img.id)}>
              <div className="image-list-container">
                {images.length > 0 && (
                  <div className="image-list">
                    {images.map((image, index) => (
                      <SortableImagePreview key={image.id} image={image} images={images} index={index}
                        isSelected={selectedImages.has(image.id)} onSelect={selectImage}
                        activeId={activeId} selectedImages={selectedImages}
                      />
                    ))}
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          {/* サムネイルの順番入れ替えの操作説明 */}
          <div className="instructions">
            <small className="instructions__text">
              {isMobile ? "長押しで順番を入れ替えられます。" : "ドラッグで順番を入れ替えられます。"}
            </small>
          </div>
        </div>

        <div className="cropper-sidebar">
          <div className="sidebar-sticky-content">
            {/* ファイル入力セクション（画像・PDF両対応） */}
            <div className="file-input">
              <input type="file" accept="image/*,application/pdf" multiple className="file-input__control" disabled={isAnyLoading}
                onClick={e => e.target.value = null} onChange={handleFileInput}
              />
            </div>

            {/* 操作ボタン群 */}
            <div className="button-group sidebar-buttons">
              <button onClick={deleteSelected} disabled={selectedImages.size === 0 || isAnyLoading} className="btn btn--danger btn-full">
                選択画像削除
              </button>
              <button onClick={resetImages} disabled={images.length === 0 || isAnyLoading} className="btn btn--danger btn-full">
                リセット
              </button>
              <button onClick={handleGeneratePdf} disabled={images.length === 0 || isAnyLoading} className="btn btn--primary btn-full">
                {isProcessing ? `PDF生成中... (${pdfProgress}%)` : 'PDFを生成'}
              </button>
              <button onClick={downloadAllImages} disabled={images.length === 0 || isAnyLoading} className="btn btn--primary btn-full">
                {isZipping ? 'ダウンロード準備中...' : '画像を一括DL'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <GalleryTray onSelectImage={addImageFromGallery} actionText="PDFに追加" />
    </div>
  );
}

function SortableImagePreview({ image, images, index, isSelected, onSelect, activeId, selectedImages }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  // グループドラッグ（選択アイテムが複数あり、そのうちの1つがドラッグされている）がアクティブか
  const isGroupDragActive = selectedImages.has(activeId) && selectedImages.size > 1;
  // このアイテムが、ドラッグされているグループの一員だが、activeなアイテムではない場合
  const isPassiveFollower = isGroupDragActive && isSelected && !isDragging;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isPassiveFollower ? 0 : 1, // グループドラッグ中の、ドラッグされていない選択済みアイテムは非表示にする
    zIndex: isDragging ? 10 : 'auto', // ドラッグ中のアイテムは最前面に表示
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ImagePreview image={image} index={index} isSelected={isSelected} onSelect={onSelect} />
      <DraggedItemStack isDragging={isDragging} isGroupDragActive={isGroupDragActive} selectedImages={selectedImages} id={image.id} images={images} />
      {isDragging && isGroupDragActive && <span className="count-badge">{selectedImages.size}</span>}
    </div>
  );
}

function ImagePreview({ image, index, isSelected, onSelect }) {
  return (
    <div className={`image-preview-item ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(image.id)}>
      <img src={image.dataUrl} alt={image.name} className="thumbnail" /> {/* サムネイルサイズをブロックに合わせて最大化し、下マージンを詰める */}
      <div className="image-info" style={{ marginTop: '0px' }}> {/* 情報とサムネイル間の隙間を詰める */}
        <p className="file-name">{image.name}</p>
        <p className="page-number">{index + 1} ページ</p>
      </div>
    </div>
  );
}

// 自分がドラッグされていて、かつそれがグループドラッグの場合に、他の選択アイテムの幻影を表示するコンポーネント
function DraggedItemStack ({ isDragging, isGroupDragActive, selectedImages, id, images }) {
  if (!isDragging || !isGroupDragActive) return null;
  // 自分以外の選択済みアイテムIDを最大2つまで取得して幻影として表示
  const otherSelectedIds = [...selectedImages].filter(selId => selId !== id).slice(0, 2);
  return otherSelectedIds.map((selId, i) => {
    const url = images.find(img => img.id == selId).dataUrl;
    return (
      <div key={i} className="image-preview-item selected stack"
        // 背後に表示、少しずらす
        style={{ zIndex: -(i + 1), transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 5}px)` }}>
        {/* 見た目だけをクローン */}
        <img src={url} alt="" className="thumbnail" />
      </div>
    );
  });
};