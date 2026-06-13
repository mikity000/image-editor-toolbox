import { useContext } from 'react';
import { GalleryContext } from '../context/GalleryContext';

export default function GalleryTray({ onSelectImage, actionText = '使用する' }) {
  const { galleryImages, removeImage, clearGallery, isGalleryOpen, setIsGalleryOpen } = useContext(GalleryContext);

  return (
    <div className="gallery-tray">
      <div className="gallery-tray__header" onClick={() => setIsGalleryOpen(!isGalleryOpen)}>
        <h3 className="gallery-tray__title">
          共有ギャラリー
          <span className="gallery-tray__count">{galleryImages.length}</span>
        </h3>
        <div className="gallery-tray__controls" onClick={(e) => e.stopPropagation()}>
          {galleryImages.length > 0 && (
            <button className="btn btn--danger" style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem' }} onClick={clearGallery}>
              全てクリア
            </button>
          )}
          <button 
            className="gallery-tray__toggle-btn" 
            onClick={(e) => {
              e.stopPropagation();
              setIsGalleryOpen(!isGalleryOpen);
            }}
          >
            <svg 
              className={isGalleryOpen ? 'gallery-tray__toggle-btn--open' : ''} 
              viewBox="0 0 24 24" 
              width="20" 
              height="20" 
              stroke="currentColor" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ transition: 'transform 0.3s ease' }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div className={`gallery-tray__content ${isGalleryOpen ? 'gallery-tray__content--open' : ''}`}>
        {galleryImages.length === 0 ? (
          <div className="gallery-tray__empty">
            ギャラリーは空です。<br />[共有ギャラリーに保存]ボタンを押下して画像を追加してください。
          </div>
        ) : (
          <ul className="gallery-tray__list">
            {galleryImages.map((image) => (
              <li key={image.id} className="gallery-item" onClick={() => onSelectImage?.(image)}>
                <img src={image.dataUrl} alt={image.name} className="gallery-item__thumbnail" />
                <p className="gallery-item__name">{image.name}</p>
                {onSelectImage && (
                  <div className="gallery-item__action-overlay">
                    <span className="gallery-item__action-text">{actionText}</span>
                  </div>
                )}
                <button
                  className="gallery-item__delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(image.id);
                  }}
                  title="ギャラリーから削除"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
