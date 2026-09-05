import React from 'react';

/**
 * トレイで扱う共通アイテムデータ形式
 */
export interface TrayItemData {
  id: string;
  name: string;
  dataUrl: string;
  rawItem?: any;
}

/**
 * TrayItem コンポーネントの Props
 */
export interface TrayItemProps {
  item: TrayItemData;
  isSelected: boolean;
  isEditing: boolean;
  renameValue: string;
  actionText?: string;
  onItemClick: (e: React.MouseEvent<HTMLLIElement>, item: TrayItemData) => void;
  onContextMenu: (e: React.MouseEvent<HTMLLIElement>, item: TrayItemData) => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * 右クリックコンテキストメニューの状態
 */
export interface ContextMenuState {
  x: number;
  y: number;
  id: string;
}

/**
 * SidebarTray コンポーネントの Props
 */
export interface SidebarTrayProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  emptyMessage: React.ReactNode;
  items?: TrayItemData[];
  onClickItem?: (item: any) => void;
  onDeleteItems?: (ids: string[]) => void;
  onRenameItem?: (id: string, newName: string) => void;
  actionText?: string;
  trayType?: 'gallery' | 'list';
}

/**
 * HelpModal コンポーネントの Props
 */
export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
}

/**
 * ヘルプモーダルの各セクション定義
 */
export interface HelpSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  path?: string;
}
