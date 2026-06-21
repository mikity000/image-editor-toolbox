import React from 'react';

export default function CollapsibleTray({
  title,
  isOpen,
  onToggle,
  headerControls,
  emptyMessage,
  items = [],
  renderItem,
}) {
  return (
    <div className={`gallery-tray ${isOpen ? 'gallery-tray--open' : ''}`}>
      <div className="gallery-tray__header" onClick={onToggle}>
        <h3 className="gallery-tray__title">{title}</h3>
        <div className="gallery-tray__controls" onClick={(e) => e.stopPropagation()}>
          {headerControls}
          <button className="gallery-tray__toggle-btn" onClick={onToggle}>
            <svg
              className={isOpen ? 'gallery-tray__toggle-btn--open' : ''}
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
      <div className={`gallery-tray__content ${isOpen ? 'gallery-tray__content--open' : ''}`}>
        {items.length === 0 ? (
          <div className="gallery-tray__empty">{emptyMessage}</div>
        ) : (
          <ul className="gallery-tray__list">
            {items.map((item, index) => renderItem(item, index))}
          </ul>
        )}
      </div>
    </div>
  );
}
