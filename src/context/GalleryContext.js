import { createContext, useState, useCallback, useMemo, useContext } from 'react';
import { generateUniqueId } from '../utils/imageUtils';
import { APP_CONFIG } from '../constants/Constants';

const STORAGE_KEYS = APP_CONFIG.STORAGE_KEYS;



const getStoredItem = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const setStoredItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`localStorageへの書き込みに失敗しました (${key}):`, err);
  }
};

export const GalleryContext = createContext(null);

export function GalleryProvider({ children }) {
  const [galleryImages, setGalleryImages] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(true);

  const [galleryViewMode, setGalleryViewModeState] = useState(() =>
    getStoredItem(STORAGE_KEYS.GALLERY_VIEW_MODE, 'grid')
  );
  const [listViewMode, setListViewModeState] = useState(() =>
    getStoredItem(STORAGE_KEYS.LIST_VIEW_MODE, 'grid')
  );

  const setGalleryViewMode = useCallback((mode) => {
    setGalleryViewModeState(mode);
    setStoredItem(STORAGE_KEYS.GALLERY_VIEW_MODE, mode);
  }, []);

  const setListViewMode = useCallback((mode) => {
    setListViewModeState(mode);
    setStoredItem(STORAGE_KEYS.LIST_VIEW_MODE, mode);
  }, []);

  // 画像の追加（単一オブジェクト、またはオブジェクトの配列）
  const addImages = useCallback((newImages) => {
    const imagesArray = Array.isArray(newImages) ? newImages : [newImages];
    const formattedImages = imagesArray.map(img => ({
      id: img.id || generateUniqueId('gallery'),
      name: img.name || '名称未設定',
      dataUrl: img.dataUrl,
      createdAt: new Date().toISOString()
    }));
    setGalleryImages((prev) => [...prev, ...formattedImages]);
  }, []);

  // 画像の削除（単一ID、またはIDの配列）
  const removeImage = useCallback((idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const idSet = new Set(ids);
    setGalleryImages((prev) => prev.filter((img) => !idSet.has(img.id)));
  }, []);

  // 画像名の変更
  const renameImage = useCallback((id, newName) => {
    setGalleryImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, name: newName } : img))
    );
  }, []);

  // ギャラリーのクリア
  const clearGallery = useCallback(() => {
    setGalleryImages([]);
  }, []);

  const contextValue = useMemo(() => ({
    galleryImages,
    addImages,
    removeImage,
    renameImage,
    clearGallery,
    isGalleryOpen,
    setIsGalleryOpen,
    galleryViewMode,
    setGalleryViewMode,
    listViewMode,
    setListViewMode,
  }), [
    galleryImages,
    addImages,
    removeImage,
    renameImage,
    clearGallery,
    isGalleryOpen,
    galleryViewMode,
    setGalleryViewMode,
    listViewMode,
    setListViewMode,
  ]);

  return (
    <GalleryContext value={contextValue}>
      {children}
    </GalleryContext>
  );
}

export function useGallery() {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGallery は GalleryProvider の内部で使用する必要があります。');
  }
  return context;
}
