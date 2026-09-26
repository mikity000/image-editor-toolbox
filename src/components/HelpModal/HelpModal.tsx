import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  FileText,
  Crop,
  Layers,
  Palette,
  FolderPlus,
  Keyboard,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { HelpModalProps, HelpSection } from '../../shared/types/ui';
import IntroSection from './sections/IntroSection';
import PdfSection from './sections/PdfSection';
import CropSection from './sections/CropSection';
import CombineSection from './sections/CombineSection';
import PaintSection from './sections/PaintSection';
import GallerySection from './sections/GallerySection';
import ShortcutsSection from './sections/ShortcutsSection';

const SECTIONS: HelpSection[] = [
  { id: 'intro', label: 'はじめに', icon: BookOpen },
  { id: 'pdf', label: '画像PDF化', icon: FileText, path: '/pdf' },
  { id: 'crop', label: '画像クロップ', icon: Crop, path: '/crop' },
  { id: 'combine', label: '画像結合', icon: Layers, path: '/combine' },
  { id: 'paint', label: 'ペイント', icon: Palette, path: '/paint' },
  { id: 'gallery', label: '共有ギャラリー', icon: FolderPlus },
  { id: 'shortcuts', label: 'ショートカット', icon: Keyboard },
];

export default function HelpModal({ isOpen, onClose, currentPath }: HelpModalProps): React.ReactElement | null {
  // 現在開いている画面タブに合わせて初期タブを決定
  const getInitialSection = (path: string): string => {
    const matched = SECTIONS.find((s) => s.path === path);
    return matched ? matched.id : 'intro';
  };

  const [activeSection, setActiveSection] = useState<string>(() => getInitialSection(currentPath));

  // モーダルが開かれた時に現在の画面に応じたタブを選択
  useEffect(() => {
    if (isOpen) {
      setActiveSection(getInitialSection(currentPath));
    }
  }, [isOpen, currentPath]);

  // Escキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="help-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <div className="help-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* モーダルヘッダー */}
        <div className="help-modal-header">
          <div className="help-modal-header-title">
            <HelpCircle className="help-header-icon" size={24} />
            <h2 id="help-modal-title">ヘルプ ＆ 操作ガイド</h2>
          </div>
          <button className="help-modal-close-btn" onClick={onClose} aria-label="ヘルプを閉じる">
            <X size={20} />
          </button>
        </div>

        {/* モーダルボディ（サイドナビ + コンテンツ） */}
        <div className="help-modal-body">
          {/* 左側ナビゲーション */}
          <nav className="help-modal-nav">
            <ul>
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    className={`help-nav-btn ${activeSection === id ? 'active' : ''}`}
                    onClick={() => setActiveSection(id)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* 右側コンテンツエリア */}
          <main className="help-modal-content">
            {activeSection === 'intro' && <IntroSection />}
            {activeSection === 'pdf' && <PdfSection />}
            {activeSection === 'crop' && <CropSection />}
            {activeSection === 'combine' && <CombineSection />}
            {activeSection === 'paint' && <PaintSection />}
            {activeSection === 'gallery' && <GallerySection />}
            {activeSection === 'shortcuts' && <ShortcutsSection />}
          </main>
        </div>

        {/* モーダルフッター */}
        <div className="help-modal-footer">
          <div className="help-footer-tip">
            <Sparkles size={16} />
            <span>キーボードの <kbd>Esc</kbd> キーでも閉じられます</span>
          </div>
          <button className="btn btn--secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
