import React, { createContext, useState, useCallback, useMemo, useContext } from 'react';
import { generateUniqueId } from '../utils/imageUtils';
import { APP_CONFIG } from '../constants/Constants';
import { GalleryImage, GalleryViewMode, GalleryContextType } from '../types/gallery';

const STORAGE_KEYS = APP_CONFIG.STORAGE_KEYS;

const getStoredItem = <T extends string>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(key);
    return (val as T) || fallback;
  } catch {
    return fallback;
  }
};

const setStoredItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`localStorageへの書き込みに失敗しました (${key}):`, err);
  }
};

export const GalleryContext = createContext<GalleryContextType | null>(null);

export interface GalleryProviderProps {
  children: React.ReactNode;
}

export function GalleryProvider({ children }: GalleryProviderProps) {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(true);

  const [galleryViewMode, setGalleryViewModeState] = useState<GalleryViewMode>(() =>
    getStoredItem<GalleryViewMode>(STORAGE_KEYS.GALLERY_VIEW_MODE, 'grid')
  );
  const [listViewMode, setListViewModeState] = useState<GalleryViewMode>(() =>
    getStoredItem<GalleryViewMode>(STORAGE_KEYS.LIST_VIEW_MODE, 'grid')
  );

  const setGalleryViewMode = useCallback((mode: GalleryViewMode) => {
    setGalleryViewModeState(mode);
    setStoredItem(STORAGE_KEYS.GALLERY_VIEW_MODE, mode);
  }, []);

  const setListViewMode = useCallback((mode: GalleryViewMode) => {
    setListViewModeState(mode);
    setStoredItem(STORAGE_KEYS.LIST_VIEW_MODE, mode);
  }, []);

  // 画像の追加（単一オブジェクト、またはオブジェクトの配列）
  const addImages = useCallback((newImages: Partial<GalleryImage> | Partial<GalleryImage>[]) => {
    const imagesArray = Array.isArray(newImages) ? newImages : [newImages];
    const formattedImages: GalleryImage[] = imagesArray.map((img) => ({
      id: img.id || generateUniqueId('gallery'),
      name: img.name || '名称未設定',
      dataUrl: img.dataUrl || '',
      createdAt: new Date().toISOString(),
    }));
    setGalleryImages((prev) => [...prev, ...formattedImages]);
  }, []);

  // 画像の削除（単一ID、またはIDの配列）
  const removeImage = useCallback((idOrIds: string | string[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const idSet = new Set(ids);
    setGalleryImages((prev) => prev.filter((img) => !idSet.has(img.id)));
  }, []);

  // 画像名の変更
  const renameImage = useCallback((id: string, newName: string) => {
    setGalleryImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, name: newName } : img))
    );
  }, []);

  // ギャラリーのクリア
  const clearGallery = useCallback(() => {
    setGalleryImages([]);
  }, []);

  const contextValue: GalleryContextType = useMemo(() => ({
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

export function useGallery(): GalleryContextType {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGallery は GalleryProvider の内部で使用する必要があります。');
  }
  return context;
}
