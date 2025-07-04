import { useState, useCallback, useRef, useEffect } from 'react';
import { setupListSync } from '../syncService';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { compressImage } from '../utils';

export default function PdfComponent() {
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false); // PDF生成中
  const [isUploading, setIsUploading] = useState(false); // 画像アップロード中
  const [uploadProgress, setUploadProgress] = useState(0); // アップロード進捗
  const [pdfProgress, setPdfProgress] = useState(0); // PDF生成進捗
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

  const uploadImage = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);

    const totalFiles = files.length; // 総ファイル数

    // 並列に全ファイルを圧縮して Data URL に変換
    let completed = 0;
    const compressPromises = files.map((file) =>
      compressImage(file).then((dataUrl) => ({
        id: URL.createObjectURL(file),
        file,
        name: file.name,
        dataUrl,
      })).finally(() => {
        completed++;
        // 完了ファイル数 ÷ 総ファイル数 で％を算出
        setUploadProgress(Math.round((completed / totalFiles) * 100));
      })
    );

    const newImages = await Promise.all(compressPromises);
    const updated = [...images, ...newImages];
    setImages(updated);
    //emitListRef.current?.(updated);
    setIsUploading(false);
    setUploadProgress(0); // 完了後に進捗をリセット
  };

  const dragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newList = arrayMove(items, oldIndex, newIndex);
        // ドラッグ順序変更を同期
        //emitListRef.current?.(newList);
        return newList;
      });
    }
  };

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
    //emitListRef.current?.(updated);
  };

  const resetImages = () => {
    setImages([]);
    //emitListRef.current?.([]);
    setSelectedImages(new Set());
  };

  const generatePdf = async () => {
    setIsProcessing(true);
    setPdfProgress(0); // 進捗をリセット
    const pdfDoc = await PDFDocument.create();
    const desiredWidth = 595.28; // A4幅 (約210mm) のPDFポイント
    const totalImages = images.length;
    let embeddedCount = 0;

    for (const imageItem of images) {
      try {
        const imageBytes = await fetch(imageItem.dataUrl).then(res => res.arrayBuffer());
        const image = await pdfDoc.embedJpg(imageBytes);

        const originalWidth = image.width;
        const originalHeight = image.height;
        const scaleFactor = desiredWidth / originalWidth;
        const scaledHeight = originalHeight * scaleFactor;

        // 各画像に対して新しいページを追加し、画像を埋め込む
        const page = pdfDoc.addPage([desiredWidth, scaledHeight]); // 画像の高さに合わせてページを追加
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: desiredWidth,
          height: scaledHeight,
        });

        embeddedCount++;
        setPdfProgress(Math.round((embeddedCount / totalImages) * 100)); // 進捗を更新

        // 小分け処理（プログレスバーの更新を滑らかにするため）
        if (embeddedCount % 3 === 0 || embeddedCount === totalImages) // 例: 3枚ごとに、または最後にレンダリング機会を与える
          await new Promise(resolve => setTimeout(resolve, 0));

      } catch (error) {
        console.error(`Error embedding image ${imageItem.name}:`, error);
        embeddedCount++; // エラーが発生してもカウントを進める
        setPdfProgress(Math.round((embeddedCount / totalImages) * 100));
        // 小分け処理（エラー時にもレンダリング機会を与える）
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    saveAs(blob, 'images.pdf');
    setIsProcessing(false);
    setPdfProgress(0); // 完了後に進捗をリセット
  };

  return (
    <div className="editor-container">
      {/* Loading Overlay */}
      {(isUploading || isProcessing) && (
        <div className="loading-overlay">
          <div className="loading-content">
            <p>{isUploading ? '画像をアップロード中...' : 'PDFを生成中...'}</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${isUploading ? uploadProgress : pdfProgress}%` }}></div>
            </div>
            <p>{isUploading ? uploadProgress : pdfProgress}%</p>
          </div>
        </div>
      )}

      {/* ファイル入力セクション */}
      <div className="file-input">
        <input type="file" accept="image/*" multiple className="file-input__control" disabled={isProcessing || isUploading}
          onClick={e => e.target.value = null} onChange={uploadImage}
        />
        <small className="file-input__hint">
          （PNG/JPEG などの画像を複数選択できます）
        </small>
      </div>

      {/* 操作ボタン群 */}
      <div className="button-group">
        <button onClick={deleteSelected} disabled={selectedImages.size === 0 || isProcessing || isUploading} className="btn btn--danger">
          選択画像削除
        </button>
        <button onClick={resetImages} disabled={images.length === 0 || isProcessing || isUploading} className="btn">
          リセット
        </button>
        <button onClick={generatePdf} disabled={images.length === 0 || isProcessing || isUploading} className="btn btn--success">
          {isProcessing ? `PDF生成中... (${pdfProgress}%)` : 'PDFを生成'}
        </button>
      </div>

      {/* 画像リスト DND コンテナ */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd} modifiers={[restrictToFirstScrollableAncestor]}>
        <SortableContext items={images.map(img => img.id)}>
          <div className="image-list-container">
            {images.length > 0 && (
              <div className="image-list">
                {images.map((image, index) => (
                  <SortableImagePreview key={image.id} id={image.id} image={image} index={index}
                    isSelected={selectedImages.has(image.id)} onSelect={selectImage}
                  />
                ))}
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* 画像の順番入れ替えの操作説明 */}
      <div className="instructions">
        <small className="instructions__text">
          {isMobile ? "長押しで順番を入れ替えられます。" : "ドラッグで順番を入れ替えられます。"}
        </small>
      </div>
    </div>
  );
}

function SortableImagePreview({ id, image, index, isSelected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ImagePreview image={image} index={index} isSelected={isSelected} onSelect={onSelect} />
    </div>
  );
}

function ImagePreview({ image, index, isSelected, onSelect }) {
  return (
    <div className={`image-preview-item ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(image.id)}>
      <img src={image.dataUrl} alt={image.name} className="thumbnail" style={{ width: '130px', height: '130px', marginBottom: '0px' }} /> {/* サムネイルサイズをブロックに合わせて最大化し、下マージンを詰める */}
      <div className="image-info" style={{ marginTop: '0px' }}> {/* 情報とサムネイル間の隙間を詰める */}
        <p className="file-name">{image.name}</p>
        <p className="page-number">{index + 1} ページ</p>
      </div>
    </div>
  );
}