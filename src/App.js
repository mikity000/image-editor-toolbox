// src/App.js
import { BrowserRouter as Router, Routes, Route, Link, Navigate  } from 'react-router-dom';
import ImageTrimming from './hooks/ImageCrop'; // クロップページ
import ImageCombine from './hooks/ImageCombine';   // 結合ページ
import ImagePdf from './hooks/ImagePdf';   // PDF化ページ
import './styles.css';

export default function App() {
  const pjName = require('../package.json').name;
  return (
    <Router>
      <div className="app-layout"> {/* アプリケーション全体のレイアウト用コンテナ */}
        <header className="app-header">
          {/* ヘッダーコンテンツ（例: アプリケーションタイトルやロゴ、グローバルナビゲーションなど） */}
          <nav className="main-nav">
            <ul>
              <li><Link to={`${pjName}/pdf`}>画像PDF化</Link></li>
              <li><Link to={`${pjName}/crop`}>画像クロップ</Link></li>
              <li><Link to={`${pjName}/combine`}>画像結合</Link></li>
            </ul>
          </nav>
        </header>

        <div> {/* メインコンテンツのコンテナ */}
          <main className="main-content"> {/* 各ページのコンテンツが表示される場所 */}
            <Routes>
              <Route path={`${pjName}/`} element={<Navigate to="crop" replace />} />
              <Route path={`${pjName}/pdf`} element={<ImagePdf />} />
              <Route path={`${pjName}/crop`} element={<ImageTrimming />} />
              <Route path={`${pjName}/combine`} element={<ImageCombine />} />
            </Routes>
          </main>
        </div>

        <footer className="app-footer">
          {/* フッターコンテンツ（例: コピーライトなど） */}
          <p>&copy; 2025 My Image App</p>
        </footer>
      </div>
    </Router>
  );
}