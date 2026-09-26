/**
 * ギャラリー関連の型定義
 */

export interface GalleryImage {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export type GalleryViewMode = 'grid' | 'list';

export interface GalleryItemDisplay {
  id: string;
  name: string;
  dataUrl: string;
  rawItem: GalleryImage;
}

export interface GalleryContextType {
  galleryImages: GalleryImage[];
  addImages: (newImages: Partial<GalleryImage> | Partial<GalleryImage>[]) => void;
  removeImage: (idOrIds: string | string[]) => void;
  renameImage: (id: string, newName: string) => void;
  clearGallery: () => void;
  isGalleryOpen: boolean;
  setIsGalleryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  galleryViewMode: GalleryViewMode;
  setGalleryViewMode: (mode: GalleryViewMode) => void;
  listViewMode: GalleryViewMode;
  setListViewMode: (mode: GalleryViewMode) => void;
}
