import React from 'react';

export default function PaintSection(): React.ReactElement {
  return (
    <div className="help-doc-section">
      <div className="help-doc-hero">
        <div className="help-doc-badge">Paint & Markup</div>
        <h3>ペイントの操作方法</h3>
        <p>画像や複数ページのPDFドキュメント上に直接ペンで手書き描画したり、境界認識塗りつぶしを行えます。</p>
      </div>

      <section className="help-section-block">
        <h4>1. 描画ツール一覧</h4>
        <div className="help-tool-grid">
          <div className="help-tool-item">
            <strong>ペン</strong>
            <p>滑らかな手書き線を描画。<kbd>Shift</kbd> キーを押しながらドラッグすると正確な直線（水平・垂直・45度斜め）をリアルタイムに描画できます。</p>
          </div>
          <div className="help-tool-item">
            <strong>蛍光ペン</strong>
            <p>下の文字や画像が透けて見える半透明ハイライト描画。<kbd>Shift</kbd> キーで直線引きに対応。</p>
          </div>
          <div className="help-tool-item">
            <strong>消しゴム</strong>
            <p>
              なぞった部分だけを削る「ピクセル消去」と、線全体を1本丸ごと消去する「ストローク消去」の2モードを切り替え可能。<kbd>Shift</kbd> キーで直線消去も可能。
            </p>
          </div>
          <div className="help-tool-item">
            <strong>塗りつぶし (3タイプ)</strong>
            <p>
              クリックした領域をワンクリックで塗りつぶします。用途に合わせて境界認識のタイプを切り替えられます。
            </p>
            <dl className="help-tool-subtypes">
              <dt>・手書き線</dt>
              <dd>描いた手書き線で囲まれた内側を塗る（背景画像は無視）</dd>
              <dt>・画像オブジェクト</dt>
              <dd>背景画像内の物体の輪郭境界を自動認識して塗る（手書き線は無視）</dd>
              <dt>・手書き＋画像</dt>
              <dd>手書き線と画像の両方を境界線として認識して塗る</dd>
            </dl>
          </div>
        </div>
      </section>

      <section className="help-section-block">
        <h4>2. カラーパレットとブラシプレビュー</h4>
        <ul className="help-step-list">
          <li>
            <strong>カラーパレット:</strong> 描画色ボタンをクリックするとポップオーバーが開き、厳選された20色のプリセットパレットから素早く選択できます。右上の「カスタム色」ピッカーから自由な色を作成することも可能です。
          </li>
          <li>
            <strong>ブラシカーソル追従プレビュー:</strong> キャンバス上では、選択中のツールの太さ・色・透明度を正確に反映した円形カーソルがリアルタイムにマウスに追従し、描画前に仕上がりを確認できます。
          </li>
          <li>
            <strong>塗りつぶし調整スライダー:</strong> 「塗りつぶし許容度（輪郭感度）」「塗りつぶし不透明度」「線の途切れ許容（線の隙間があっても外に漏れ出さずに塞いで塗る幅）」を細かく調整できます。
          </li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>3. 複数ページPDF対応とエクスポート</h4>
        <ul className="help-step-list">
          <li>
            <strong>PDFの複数ページ注釈:</strong> 複数ページのPDFを読み込んだ場合、画面上部の「◀ / ▶」ボタンでページをめくりながら、個別のページごとに書き込みを行えます。
          </li>
          <li>
            <strong>画像として保存 (WebP):</strong> 現在表示中のページの合成結果を高画質WebP形式でダウンロードします。
          </li>
          <li>
            <strong>PDFとして保存:</strong> 全ページの書き込み内容を反映した1冊のPDFドキュメントとしてまとめてダウンロードします。
          </li>
          <li>
            <strong>共有ギャラリーに保存:</strong> 現在のページをワンクリックでアプリ内の共有ギャラリーに保存します。
          </li>
        </ul>
      </section>
    </div>
  );
}
