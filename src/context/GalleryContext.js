import { createContext, useState } from 'react';

export const GalleryContext = createContext();

export function GalleryProvider({ children }) {
  const [galleryImages, setGalleryImages] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(true);
  const [galleryViewMode, setGalleryViewModeState] = useState(() => {
    return localStorage.getItem('sidebar_gallery_view_mode') || 'grid';
  });
  const [listViewMode, setListViewModeState] = useState(() => {
    return localStorage.getItem('sidebar_list_view_mode') || 'grid';
  });

  const setGalleryViewMode = (mode) => {
    setGalleryViewModeState(mode);
    localStorage.setItem('sidebar_gallery_view_mode', mode);
  };

  const setListViewMode = (mode) => {
    setListViewModeState(mode);
    localStorage.setItem('sidebar_list_view_mode', mode);
  };

  // 画像の追加（単一オブジェクト、またはオブジェクトの配列を受け取る）
  const addImages = (newImages) => {
    const imagesArray = Array.isArray(newImages) ? newImages : [newImages];
    const formattedImages = imagesArray.map(img => ({
      id: img.id || `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: img.name || '名称未設定',
      dataUrl: img.dataUrl,
      createdAt: new Date().toISOString()
    }));
    setGalleryImages((prev) => [...prev, ...formattedImages]);
  };

  // 画像の削除（単一ID、またはIDの配列を受け取る）
  const removeImage = (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    setGalleryImages((prev) => prev.filter((img) => !ids.includes(img.id)));
  };

  // 画像名の変更
  const renameImage = (id, newName) => {
    setGalleryImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, name: newName } : img))
    );
  };

  // ギャラリーのクリア
  const clearGallery = () => {
    setGalleryImages([]);
  };

  return (
    <GalleryContext value={{ galleryImages, addImages, removeImage, renameImage, clearGallery, isGalleryOpen, setIsGalleryOpen, galleryViewMode, setGalleryViewMode, listViewMode, setListViewMode }}>
      {children}
    </GalleryContext>
  );
}
