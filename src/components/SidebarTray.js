import React, { useState, useEffect, useRef } from 'react';

export default function SidebarTray({
  title,
  isOpen,
  onToggle,
  emptyMessage,
  items = [], // { id, name, dataUrl, rawItem } 形式
  onClickItem,
  onDeleteItems,
  onRenameItem,
  actionText,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { x, y, id }
  const [lastClickedId, setLastClickedId] = useState(null);
  const trayRef = useRef(null);

  // コンテキストメニューを閉じる
  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Ctrl+A の全選択キー制御
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      const allIds = items.map(item => item.id);
      setSelectedIds(new Set(allIds));
    }
  };

  const handleItemClick = (e, item) => {
    const { id } = item;
    const allIds = items.map(i => i.id);

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+クリック: 選択のトグル
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedIds(newSelected);
      setLastClickedId(id);
    } else if (e.shiftKey && lastClickedId) {
      // Shift+クリック: 範囲選択
      const lastIndex = allIds.indexOf(lastClickedId);
      const currentIndex = allIds.indexOf(id);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = allIds.slice(start, end + 1);
        setSelectedIds(new Set(rangeIds));
      }
    } else {
      // 通常クリック: 単一選択 + アクション実行
      setSelectedIds(new Set([id]));
      setLastClickedId(id);
      onClickItem?.(item.rawItem || item);
    }
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    const { id } = item;

    // 右クリックしたアイテムが選択されていない場合、それ単体を選択
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set([id]));
      setLastClickedId(id);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      id: id,
    });
  };

  const startRename = (id) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setEditingId(id);
      setRenameValue(item.name);
    }
    setContextMenu(null);
  };

  const handleRenameSubmit = () => {
    if (editingId && renameValue.trim()) {
      onRenameItem?.(editingId, renameValue.trim());
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleDelete = () => {
    if (selectedIds.size > 0) {
      onDeleteItems?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setContextMenu(null);
  };

  return (
    <div
      ref={trayRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ outline: 'none' }}
      className={`sidebar-tray ${isOpen ? 'sidebar-tray--open' : ''}`}
    >
      <div className="sidebar-tray__header" onClick={onToggle}>
        <h3 className="sidebar-tray__title">{title}</h3>
        <div className="sidebar-tray__controls" onClick={(e) => e.stopPropagation()}>
          <button className="sidebar-tray__toggle-btn" onClick={onToggle}>
            <svg
              className={isOpen ? 'sidebar-tray__toggle-btn--open' : ''}
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

      <div className={`sidebar-tray__content ${isOpen ? 'sidebar-tray__content--open' : ''}`}>
        {items.length === 0 ? (
          <div className="sidebar-tray__empty">{emptyMessage}</div>
        ) : (
          <ul className="sidebar-tray__list">
            {items.map((item, index) => {
              const isSelected = selectedIds.has(item.id);
              const isEditing = editingId === item.id;

              return (
                <li
                  key={item.id}
                  className={`tray-item ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => handleItemClick(e, item)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                >
                  <img src={item.dataUrl} alt={item.name} className="tray-item__thumbnail" />
                  {actionText && !isEditing && (
                    <div className="tray-item__action-overlay">
                      <span className="tray-item__action-text">{actionText}</span>
                    </div>
                  )}
                  {isEditing ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={handleRenameKeyDown}
                      autoFocus
                      className="tray-item__rename-input"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className="tray-item__name">{item.name}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul className="context-menu__list">
            <li className="context-menu__item" onClick={() => startRename(contextMenu.id)}>名前の変更</li>
            <li className="context-menu__item" onClick={handleDelete}>削除</li>
          </ul>
        </div>
      )}
    </div>
  );
}
