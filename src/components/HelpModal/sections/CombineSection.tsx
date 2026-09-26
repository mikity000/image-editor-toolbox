import React from 'react';

export default function CombineSection(): React.ReactElement {
  return (
    <div className="help-doc-section">
      <div className="help-doc-hero">
        <div className="help-doc-badge">Combiner</div>
        <h3>画像結合の操作方法</h3>
        <p>広大なキャンバス上に複数の画像を自由に配置・コラージュし、1枚の画像として書き出します。</p>
      </div>

      <section className="help-section-block">
        <h4>1. キャンバスのナビゲーション</h4>
        <div className="help-kbd-table">
          <div className="help-kbd-row">
            <div className="help-kbd-key"><kbd>マウスホイール</kbd> / <kbd>ピンチ</kbd></div>
            <div className="help-kbd-desc">キャンバスのズームイン / ズームアウト（拡大・縮小）</div>
          </div>
          <div className="help-kbd-row">
            <div className="help-kbd-key"><kbd>Alt</kbd> + <kbd>ドラッグ</kbd> / <kbd>二本指ドラッグ</kbd></div>
            <div className="help-kbd-desc">キャンバス全体のパン（平行移動）</div>
          </div>
        </div>
      </section>

      <section className="help-section-block">
        <h4>2. 画像の配置と編集</h4>
        <ul className="help-step-list">
          <li>
            <strong>画像の追加:</strong> ファイル選択または左サイドバーの「共有ギャラリー」から画像を追加します。
          </li>
          <li>
            <strong>変形と回転:</strong> キャンバス上の画像をクリックすると枠（バウンディングボックス）が表示され、四隅をドラッグして拡大縮小、回転ハンドルで回転できます。
          </li>
          <li>
            <strong>動的グリッド表示 (マス目):</strong> ズーム倍率とテーマに合わせて自動で適切な間隔・カラーでスケーリングするグリッド線が表示され、正確な配置を補助します（出力時は非表示）。
          </li>
          <li>
            <strong>スナップ＆スマートガイド:</strong> 画像を動かすと、他の画像のエッジや中心線に合わせて自動吸着し、赤い整列ガイドラインが表示されます。ガイド線の太さはサイドバーのスライダーで調整可能です。
          </li>
          <li>
            <strong>レイヤー順序操作:</strong> 重なり順を「最前面」「前面」「背面」「最背面」ボタンでワンクリック変更できます。
          </li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>3. サイドバー「画像一覧」トレイ</h4>
        <p>
          左サイドバーには「共有ギャラリー」に加え、現在キャンバスに配置されている画像の一覧トレイが備わっています。
        </p>
        <ul className="help-step-list">
          <li>
            <strong>自動フォーカス＆ズーム:</strong> 画像一覧のアイテムをクリックすると、対象の画像がキャンバス中央に収まるよう自動でビューポートがスクロール＆ズームします。
          </li>
          <li>
            <strong>一覧からの名前変更・削除:</strong> 配置画像のファイル名の変更や、不要な画像の削除をトレイから直接行えます。
          </li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>4. 余白自動トリミングエクスポート</h4>
        <p>
          「ダウンロード」または「共有ギャラリーに保存」を実行すると、キャンバス全体の広大な余白は自動で切り落とされ、<strong>配置されている画像群が占める最小の矩形領域だけがぴったりトリミングされた高画質WebP画像</strong>として書き出されます。
        </p>
      </section>
    </div>
  );
}
