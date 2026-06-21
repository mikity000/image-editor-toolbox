import { createContext, useState } from 'react';

export const GalleryContext = createContext();

export function GalleryProvider({ children }) {
  const [galleryImages, setGalleryImages] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(true);

  // 画像の追加（単一オブジェクト、またはオブジェクトの配列を受け取る）
  const addImages = (newImages) => {
    const imagesArray = Array.isArray(newImages) ? newImages : [newImages];
    const formattedImages = imagesArray.map(img => ({
      id: img.id || `gallery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    <GalleryContext.Provider value={{ galleryImages, addImages, removeImage, renameImage, clearGallery, isGalleryOpen, setIsGalleryOpen }}>
      {children}
    </GalleryContext.Provider>
  );
}
