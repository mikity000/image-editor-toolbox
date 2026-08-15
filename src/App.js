import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

import { /*BrowserRouter*/ HashRouter as Router, Routes, Route, NavLink, Navigate, useLocation  } from 'react-router-dom';
import ImageTrimming from './pages/ImageCrop'; // クロップページ
import ImageCombine from './pages/ImageCombine';   // 結合ページ
import ImagePdf from './pages/ImagePdf';   // PDF化ページ
import { GalleryProvider } from './context/GalleryContext';
import './styles.css';

function AppContent() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isPdf = currentPath === '/pdf';
  const isCrop = currentPath === '/crop';
  const isCombine = currentPath === '/combine';

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-layout"> {/* アプリケーション全体のレイアウト用コンテナ */}
      <header className="app-header">
        {/* ヘッダーコンテンツ */}
        <nav className="main-nav">
          <ul>
            <li><NavLink to="/pdf" className={isPdf ? 'active' : ''}>画像PDF化</NavLink></li>
            <li><NavLink to="/crop" className={isCrop ? 'active' : ''}>画像クロップ</NavLink></li>
            <li><NavLink to="/combine" className={isCombine ? 'active' : ''}>画像結合</NavLink></li>
          </ul>
        </nav>

        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {/* 太陽/月アイコン */}
          {theme === 'dark' ? (<Sun size={20} />) : (<Moon size={20} />)}
        </button>
      </header>

      <div className="app-body"> {/* メインコンテンツのコンテナ */}
        <main className="main-content main-content--relative">
          <div className={`tab-content-wrapper ${isPdf ? '' : 'is-hidden'}`}>
            <ImagePdf />
          </div>
          <div className={`tab-content-wrapper ${isCrop ? '' : 'is-hidden'}`}>
            <ImageTrimming />
          </div>
          <div className={`tab-content-wrapper ${isCombine ? '' : 'is-hidden'}`}>
            <ImageCombine />
          </div>

          <Routes>
            <Route path="/" element={<Navigate to="/crop" replace />} />
            <Route path="/pdf" element={null} />
            <Route path="/crop" element={null} />
            <Route path="/combine" element={null} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GalleryProvider>
      <Router>
        <AppContent />
      </Router>
    </GalleryProvider>
  );
}