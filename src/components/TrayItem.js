import React from 'react';

export default function TrayItem({
  src,
  alt,
  name,
  onClick,
  actionText,
  onDelete,
}) {
  return (
    <li className="gallery-item" onClick={onClick}>
      <img src={src} alt={alt} className="gallery-item__thumbnail" />
      <p className="gallery-item__name">{name}</p>
      {actionText && (
        <div className="gallery-item__action-overlay">
          <span className="gallery-item__action-text">{actionText}</span>
        </div>
      )}
      {onDelete && (
        <button
          className="gallery-item__delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          &times;
        </button>
      )}
    </li>
  );
}
