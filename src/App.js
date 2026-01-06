import { /*BrowserRouter*/ HashRouter as Router, Routes, Route, Link, Navigate  } from 'react-router-dom';
import ImageTrimming from './hooks/ImageCrop'; // クロップページ
import ImageCombine from './hooks/ImageCombine';   // 結合ページ
import ImagePdf from './hooks/ImagePdf';   // PDF化ページ
import './styles.css';

export default function App() {
  //const pjName = require('../package.json').name;
  return (
    <Router>
      <div className="app-layout"> {/* アプリケーション全体のレイアウト用コンテナ */}
        <header className="app-header">
          {/* ヘッダーコンテンツ */}
          <nav className="main-nav">
            <ul>
              <li><Link to={`/pdf`}>画像PDF化</Link></li> {/* ${pjName}/pdf */}
              <li><Link to={`/crop`}>画像クロップ</Link></li> {/* ${pjName}/crop */}
              <li><Link to={`/combine`}>画像結合</Link></li> {/* ${pjName}/combine */}
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
  );
}