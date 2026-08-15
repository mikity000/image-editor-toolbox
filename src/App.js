import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { HashRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import ImagePdf from './pages/ImagePdf';
import ImageCrop from './pages/ImageCrop';
import ImageCombine from './pages/ImageCombine';
import { GalleryProvider } from './context/GalleryContext';
import './styles.css';

const TABS = [
  { path: '/pdf', label: '画像PDF化', Component: ImagePdf },
  { path: '/crop', label: '画像クロップ', Component: ImageCrop },
  { path: '/combine', label: '画像結合', Component: ImageCombine },
];

function AppContent() {
  const location = useLocation();
  const currentPath = location.pathname;

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

        <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="テーマ切り替え">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

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

export default function App() {
  return (
    <GalleryProvider>
      <Router>
        <AppContent />
      </Router>
    </GalleryProvider>
  );
}