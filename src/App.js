import { /*BrowserRouter*/ HashRouter as Router, Routes, Route, NavLink, Navigate  } from 'react-router-dom';
import ImageTrimming from './pages/ImageCrop'; // クロップページ
import ImageCombine from './pages/ImageCombine';   // 結合ページ
import ImagePdf from './pages/ImagePdf';   // PDF化ページ
import { GalleryProvider } from './context/GalleryContext';
import './styles.css';

export default function App() {
  return (
    <GalleryProvider>
      <Router>
        <div className="app-layout"> {/* アプリケーション全体のレイアウト用コンテナ */}
          <header className="app-header">
            {/* ヘッダーコンテンツ */}
            <nav className="main-nav">
              <ul>
                <li><NavLink to="/pdf">画像PDF化</NavLink></li>
                <li><NavLink to="/crop">画像クロップ</NavLink></li>
                <li><NavLink to="/combine">画像結合</NavLink></li>
              </ul>
            </nav>
          </header>

          <div className="app-body"> {/* メインコンテンツのコンテナ */}
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Navigate to="crop" replace />} />
                <Route path="/pdf" element={<ImagePdf />} />
                <Route path="/crop" element={<ImageTrimming />} />
                <Route path="/combine" element={<ImageCombine />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </GalleryProvider>
  );
}