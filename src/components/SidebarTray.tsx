import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { LayoutGrid, List, ChevronDown, Edit2, Trash2 } from 'lucide-react';
import { GalleryContext } from '../context/GalleryContext';
import TrayItem from './TrayItem';
import { SidebarTrayProps, ContextMenuState, TrayItemData } from '../types/ui';

export default function SidebarTray({
  title,
  isOpen,
  onToggle,
  emptyMessage,
  items = [],
  onClickItem,
  onDeleteItems,
  onRenameItem,
  actionText,
  trayType = 'gallery',
}: SidebarTrayProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const { galleryViewMode, setGalleryViewMode, listViewMode, setListViewMode } = useContext(GalleryContext);
  const viewMode = trayType === 'list' ? listViewMode : galleryViewMode;
  const setViewMode = trayType === 'list' ? setListViewMode : setGalleryViewMode;
  const trayRef = useRef<HTMLDivElement | null>(null);

  // コンテキストメニューを閉じる
  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setEditingId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Ctrl+A の全選択キー制御
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      const allIds = items.map((item) => item.id);
      setSelectedIds(new Set(allIds));
    }
  }, [items]);

  const handleItemClick = useCallback((e: React.MouseEvent<HTMLLIElement>, item: TrayItemData) => {
    const { id } = item;
    const allIds = items.map((i) => i.id);

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+クリック: 選択のトグル
      setSelectedIds((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        return newSelected;
      });
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
  }, [items, lastClickedId, onClickItem]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLLIElement>, item: TrayItemData) => {
    e.preventDefault();
    const { id } = item;

    // 右クリックしたアイテムが選択されていない場合、それ単体を選択
    setSelectedIds((prev) => {
      if (!prev.has(id)) {
        return new Set([id]);
      }
      return prev;
    });
    setLastClickedId(id);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      id,
    });
  }, []);

  const startRename = useCallback((id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) {
      setEditingId(id);
      setRenameValue(item.name);
    }
    setContextMenu(null);
  }, [items]);

  const handleRenameSubmit = useCallback(() => {
    if (editingId && renameValue.trim()) {
      onRenameItem?.(editingId, renameValue.trim());
    }
    setEditingId(null);
  }, [editingId, renameValue, onRenameItem]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }, [handleRenameSubmit]);

  const handleDelete = useCallback(() => {
    if (selectedIds.size > 0) {
      onDeleteItems?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setContextMenu(null);
  }, [selectedIds, onDeleteItems]);

  return (
    <div
      ref={trayRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`sidebar-tray ${isOpen ? 'sidebar-tray--open' : ''} sidebar-tray--${viewMode}`}
    >
      <div className="sidebar-tray__header" onClick={onToggle}>
        <h3 className="sidebar-tray__title">{title}</h3>
        <div className="sidebar-tray__controls" onClick={(e) => e.stopPropagation()}>
          <div className="sidebar-tray__view-buttons">
            <button 
              className={`sidebar-tray__view-btn ${viewMode === 'grid' ? 'active' : ''}`} 
              onClick={() => setViewMode('grid')}
              aria-label="グリッド表示"
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              className={`sidebar-tray__view-btn ${viewMode === 'list' ? 'active' : ''}`} 
              onClick={() => setViewMode('list')}
              aria-label="リスト表示"
            >
              <List size={16} />
            </button>
          </div>
          <button className="sidebar-tray__toggle-btn" onClick={onToggle} aria-label="トレイ開閉">
            <ChevronDown size={20} className={isOpen ? 'sidebar-tray__toggle-btn--open' : ''} />
          </button>
        </div>
      </div>

      <div className={`sidebar-tray__content ${isOpen ? 'sidebar-tray__content--open' : ''}`}>
        {items.length === 0 ? (
          <div className="sidebar-tray__empty">{emptyMessage}</div>
        ) : (
          <ul className="sidebar-tray__list">
            {items.map((item) => (
              <TrayItem
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                isEditing={editingId === item.id}
                renameValue={renameValue}
                actionText={actionText}
                onItemClick={handleItemClick}
                onContextMenu={handleContextMenu}
                onRenameChange={setRenameValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameKeyDown={handleRenameKeyDown}
              />
            ))}
          </ul>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul className="context-menu__list">
            <li className="context-menu__item" onClick={() => startRename(contextMenu.id)}>
              <Edit2 size={14} />名前の変更
            </li>
            <li className="context-menu__item" onClick={handleDelete}>
              <Trash2 size={14} />削除
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
