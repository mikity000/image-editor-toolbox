import React from 'react';
import { FileText, Crop, Layers, Palette, Info } from 'lucide-react';

export default function IntroSection(): React.ReactElement {
  return (
    <div className="help-doc-section">
      <div className="help-doc-hero">
        <div className="help-doc-badge">Overview</div>
        <h3>画像編集ツールボックスへようこそ</h3>
        <p>
          本アプリケーションは、ブラウザ上で高度な画像編集・変換・コラージュ・ペイントを行える高機能ツールキットです。
          サーバーへの画像アップロードを行わず、すべてお手元のブラウザ内で安全・高速に処理されます。
        </p>
      </div>

      <div className="help-feature-grid">
        <div className="help-feature-card">
          <div className="help-card-icon"><FileText size={22} /></div>
          <h4>画像PDF化</h4>
          <p>複数画像をPDFに一括変換。既存PDFからの画像自動抽出やZIP一括ダウンロードにも対応。</p>
        </div>
        <div className="help-feature-card">
          <div className="help-card-icon"><Crop size={22} /></div>
          <h4>画像クロップ</h4>
          <p>矩形、円形、多角形、フリーハンドでの精密切り抜き。輪郭への自動吸着やプレビュー上での頂点選択を搭載。</p>
        </div>
        <div className="help-feature-card">
          <div className="help-card-icon"><Layers size={22} /></div>
          <h4>画像結合</h4>
          <p>広大なキャンバス上での自由配置・コラージュ。動的グリッド、スマートガイド、配置領域の余白自動トリミング書き出し。</p>
        </div>
        <div className="help-feature-card">
          <div className="help-card-icon"><Palette size={22} /></div>
          <h4>ペイント</h4>
          <p>画像や複数ページPDFへの手書き注釈。3タイプ対応の境界認識塗りつぶし、直線スナップ、ブラシカーソルプレビュー。</p>
        </div>
      </div>

      <div className="help-info-box">
        <Info size={20} />
        <div>
          <strong>共有ギャラリーで全画面が連携</strong>
          <p>クロップ、PDF抽出、結合、ペイントで作成した画像は「共有ギャラリー」を通じて各画面へワンクリックで受け渡すことができます。</p>
        </div>
      </div>
    </div>
  );
}
