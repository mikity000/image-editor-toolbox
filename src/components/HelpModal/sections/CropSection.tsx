import React from 'react';

export default function CropSection(): React.ReactElement {
  return (
    <div className="help-doc-section">
      <div className="help-doc-hero">
        <div className="help-doc-badge">Cropper</div>
        <h3>画像クロップの操作方法</h3>
        <p>画像から必要な部分を自由な形状で精密に切り抜きます。エッジ検出による自動吸着や反転クロップにも対応しています。</p>
      </div>

      <section className="help-section-block">
        <h4>1. クロップ形状の選択</h4>
        <div className="help-grid-cards">
          <div className="help-small-card">
            <strong>四角形 (Rect)</strong>
            <p>標準的な長方形・正方形で範囲を囲んで切り抜きます。</p>
          </div>
          <div className="help-small-card">
            <strong>円形 (Circle)</strong>
            <p>正円や楕円の形状で範囲を切り抜きます。</p>
          </div>
          <div className="help-small-card">
            <strong>多角形 (Polygon)</strong>
            <p>キャンバス上をクリックして複数の頂点を配置し、自由な多角形を作成します。</p>
          </div>
          <div className="help-small-card">
            <strong>フリーハンド (Path)</strong>
            <p>マウスやペンでなぞって描いた自由な軌跡で切り抜きます。滑らかさ補正スライダー付き。</p>
          </div>
        </div>
      </section>

      <section className="help-section-block">
        <h4>2. 多角形クロップと吸着（マグネット）モード</h4>
        <ul className="help-step-list">
          <li>
            <strong>頂点の追加:</strong> 画像上をクリックしていくと頂点と線が順に結ばれます。
          </li>
          <li>
            <strong>吸着モード（マグネット）:</strong> 吸着モードを有効にすると、物体の境界線（輪郭）にマウスカーソルが近づいた際、頂点が自動的にエッジに吸着します。感度スライダーで吸着の強さを調整できます。
          </li>
          <li>
            <strong>描画完了:</strong> 「描画完了」ボタンを押すと形状が確定し、自動的にクロップ結果が生成されます。
          </li>
          <li>
            <strong>プレビューからの頂点選択:</strong> クロップ確定後、右側のプレビュー画像上に表示される青い頂点マーカーを直接クリックして任意の頂点を選択できます。
          </li>
          <li>
            <strong>0.5px単位の頂点微調整:</strong> 選択した頂点は、サイドバーの「←」「→」「↑」「↓」ボタンで0.5px単位で微調整したり、「頂点を削除」でピンポイントに削除できます。
          </li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>3. 便利な機能とエクスポート</h4>
        <ul className="help-step-list">
          <li>
            <strong>外側を切り取る（反転クロップ）:</strong> 「外側を切り取る」にチェックを入れると、選択範囲の内側を残すのではなく、選択範囲をくり抜いて外側の領域を残します。
          </li>
          <li>
            <strong>各辺の微調整:</strong> 四角形・円形クロップ時は、「上辺」「右辺」「左辺」「下辺」ごとに微調整ボタン（- / +）で0.5px刻みのサイズ調整が可能です。
          </li>
          <li>
            <strong>曲線の滑らかさ補正:</strong> フリーハンド描画時は、スライダーで曲線のスムージング度合いを調整できます。
          </li>
          <li>
            <strong>高解像度エクスポート:</strong> 画面上の表示サイズにかかわらず、元画像のオリジナル解像度を保持したまま切り抜かれます。「ダウンロード（WebP）」または「共有ギャラリーに保存」が利用できます。
          </li>
        </ul>
      </section>
    </div>
  );
}
