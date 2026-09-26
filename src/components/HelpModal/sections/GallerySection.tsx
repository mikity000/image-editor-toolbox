import React from 'react';

export default function GallerySection(): React.ReactElement {
  return (
    <div className="help-doc-section">
      <div className="help-doc-hero">
        <div className="help-doc-badge">Shared Gallery</div>
        <h3>共有ギャラリー＆共通機能</h3>
        <p>アプリ全体でデータを共有し、複数の編集機能を連携させるための仕組みです。</p>
      </div>

      <section className="help-section-block">
        <h4>1. 共有ギャラリーの役割</h4>
        <p>
          画面左側の「共有ギャラリー」トレイは、アプリの全タブ（クロップ、PDF、結合、ペイント）で共通して使える画像保管庫です。
        </p>
        <ul className="help-step-list">
          <li>クロップ画面で切り抜いた画像をギャラリーに保存</li>
          <li>結合画面を開いてギャラリーから画像をキャンバスに配置</li>
          <li>ペイント画面でギャラリーから読み込んで注釈や塗りつぶしを追加</li>
          <li>PDF画面でギャラリーの画像を取り込んでPDF化</li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>2. ギャラリーの操作</h4>
        <ul className="help-step-list">
          <li>
            <strong>開閉トグル:</strong> 左端のトレイバーをクリックしてギャラリーを開閉できます。
          </li>
          <li>
            <strong>表示切り替え:</strong> グリッド（サムネイル一覧）とリスト表示を切り替え可能。設定はブラウザに自動記憶されます。
          </li>
          <li>
            <strong>名前変更・削除:</strong> アイテムの名前変更や不要な画像の削除を行えます。
          </li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>3. テーマ切り替え</h4>
        <p>
          ヘッダー右上の太陽 / 月アイコンをクリックすると、ダークテーマとライトテーマを瞬時に切り替えられます。設定は自動保存され、次回アクセス時も維持されます。
        </p>
      </section>
    </div>
  );
}
