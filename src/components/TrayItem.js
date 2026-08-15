import { memo } from 'react';

const TrayItem = memo(function TrayItem({
  item,
  isSelected,
  isEditing,
  renameValue,
  actionText,
  onItemClick,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameKeyDown,
}) {
  return (
    <li
      className={`tray-item ${isSelected ? 'selected' : ''}`}
      onClick={(e) => onItemClick(e, item)}
      onContextMenu={(e) => onContextMenu(e, item)}
    >
      <img src={item.dataUrl} alt={item.name} className="tray-item__thumbnail" decoding="sync" />
      {actionText && !isEditing && (
        <div className="tray-item__action-overlay">
          <span className="tray-item__action-text">{actionText}</span>
        </div>
      )}
      {isEditing ? (
        <input
          type="text"
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onRenameSubmit}
          onKeyDown={onRenameKeyDown}
          autoFocus
          className="tray-item__rename-input"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <p className="tray-item__name">{item.name}</p>
      )}
    </li>
  );
});

export default TrayItem;

