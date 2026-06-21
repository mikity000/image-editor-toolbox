import { useContext } from 'react';
import { GalleryContext } from '../context/GalleryContext';
import CollapsibleTray from './CollapsibleTray';
import TrayItem from './TrayItem';

export default function GalleryTray({ onSelectImage, actionText = '使用する' }) {
  const { galleryImages, removeImage, clearGallery, isGalleryOpen, setIsGalleryOpen } = useContext(GalleryContext);

  const headerControls = galleryImages.length > 0 && (
    <button className="btn btn--danger" style={{ padding: '0.2rem 0.6rem' }} onClick={clearGallery}>
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s ease' }}>
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  );

  return (
    <CollapsibleTray
      title="共有ギャラリー"
      isOpen={isGalleryOpen}
      onToggle={() => setIsGalleryOpen(!isGalleryOpen)}
      headerControls={headerControls}
      emptyMessage={<>ギャラリーは空です。<br />[共有ギャラリーに保存]ボタンを押下して画像を追加してください。</>}
      items={galleryImages}
      renderItem={(image) => (
        <TrayItem
          key={image.id}
          src={image.dataUrl}
          alt={image.name}
          name={image.name}
          onClick={() => onSelectImage?.(image)}
          actionText={onSelectImage ? actionText : undefined}
          onDelete={() => removeImage(image.id)}
        />
      )}
    />
  );
}
