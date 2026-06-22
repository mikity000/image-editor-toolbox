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
    <li className="tray-item" onClick={onClick}>
      <img src={src} alt={alt} className="tray-item__thumbnail" />
      <p className="tray-item__name">{name}</p>
      {actionText && (
        <div className="tray-item__action-overlay">
          <span className="tray-item__action-text">{actionText}</span>
        </div>
      )}
      {onDelete && (
        <button
          className="tray-item__delete-btn"
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
