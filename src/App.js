import { /*BrowserRouter*/ HashRouter as Router, Routes, Route, NavLink, Navigate  } from 'react-router-dom';
import ImageTrimming from './pages/ImageCrop'; // クロップページ
import ImageCombine from './pages/ImageCombine';   // 結合ページ
import ImagePdf from './pages/ImagePdf';   // PDF化ページ
import { GalleryProvider } from './context/GalleryContext';
import './styles.css';

export default function App() {
  //const pjName = require('../package.json').name;
  return (
    <GalleryProvider>
      <Router>
        <div className="app-layout"> {/* アプリケーション全体のレイアウト用コンテナ */}
          <header className="app-header">
            {/* ヘッダーコンテンツ */}
            <nav className="main-nav">
              <ul>
                <li><NavLink to={`/pdf`}>画像PDF化</NavLink></li> {/* ${pjName}/pdf */}
                <li><NavLink to={`/crop`}>画像クロップ</NavLink></li> {/* ${pjName}/crop */}
                <li><NavLink to={`/combine`}>画像結合</NavLink></li> {/* ${pjName}/combine */}
              </ul>
            </nav>
          </header>

          <div> {/* メインコンテンツのコンテナ */}
            <main className="main-content">
              <Routes>
                <Route path={`/`} element={<Navigate to="crop" replace />} /> {/* / */}
                <Route path={`/pdf`} element={<ImagePdf />} /> {/* ${pjName}/pdf */}
                <Route path={`/crop`} element={<ImageTrimming />} /> {/* ${pjName}/crop */}
                <Route path={`/combine`} element={<ImageCombine />} /> {/* ${pjName}/combine */}
              </Routes>
            </main>
          </div>

          <footer className="app-footer">
            {/* フッターコンテンツ */}
            <p>&copy; 2025 My Image App</p>
          </footer>
        </div>
      </Router>
    </GalleryProvider>
  );
}