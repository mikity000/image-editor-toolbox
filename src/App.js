import { useState, useEffect } from 'react';
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

        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            /* ダークテーマ時：太陽アイコンを表示 */
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            /* ライトテーマ時：月アイコンを表示 */
            <svg viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </header>

      <div className="app-body"> {/* メインコンテンツのコンテナ */}
        <main className="main-content" style={{ position: 'relative', height: '100%' }}>
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