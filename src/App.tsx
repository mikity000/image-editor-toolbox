import React, { useState, useEffect } from 'react';
import { Sun, Moon, HelpCircle } from 'lucide-react';
import { HashRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import PdfPage from './pages/PdfPage';
import CropPage from './pages/CropPage';
import CombinePage from './pages/CombinePage';
import PaintPage from './pages/PaintPage';
import HelpModal from './components/HelpModal';
import { GalleryProvider } from './features/gallery/context/GalleryContext';
import { ToastProvider } from './shared/context/ToastContext';
import './styles/index.css';

interface TabItem {
  path: string;
  label: string;
  Component: React.ComponentType;
}

const TABS: TabItem[] = [
  { path: '/pdf', label: '画像PDF化', Component: PdfPage },
  { path: '/crop', label: '画像クロップ', Component: CropPage },
  { path: '/combine', label: '画像結合', Component: CombinePage },
  { path: '/paint', label: 'ペイント', Component: PaintPage },
];

function AppContent(): React.ReactElement {
  const location = useLocation();
  const currentPath = location.pathname;

  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <nav className="main-nav">
          <ul>
            {TABS.map(({ path, label }) => (
              <li key={path}>
                <NavLink to={path} className={currentPath === path ? 'active' : ''}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <button
            className="help-btn-header"
            onClick={() => setIsHelpOpen(true)}
            aria-label="ヘルプ・操作ガイドを開く"
            title="操作方法・ヘルプ"
          >
            <HelpCircle size={20} />
          </button>

          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="テーマ切り替え" title="テーマ切り替え">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        currentPath={currentPath}
      />

      <div className="app-body">
        <main className="main-content main-content--relative">
          {TABS.map(({ path, Component }) => (
            <div
              key={path}
              className={`tab-content-wrapper ${currentPath === path ? '' : 'is-hidden'}`}
            >
              <Component />
            </div>
          ))}

          <Routes>
            <Route path="/" element={<Navigate to="/crop" replace />} />
            {TABS.map(({ path }) => (
              <Route key={path} path={path} element={null} />
            ))}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App(): React.ReactElement {
  return (
    <ToastProvider>
      <GalleryProvider>
        <Router>
          <AppContent />
        </Router>
      </GalleryProvider>
    </ToastProvider>
  );
}
