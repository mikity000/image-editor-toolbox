import React from 'react';

export default function PdfSection(): React.ReactElement {
  return (
    <div className="help-doc-section">
      <div className="help-doc-hero">
        <div className="help-doc-badge">PDF & Archive</div>
        <h3>画像PDF化の操作方法</h3>
        <p>複数の画像をひとつのPDFにまとめたり、PDFファイルから画像を自動抽出して編集できます。</p>
      </div>

      <section className="help-section-block">
        <h4>1. 画像・PDFの追加と読み込み</h4>
        <ul className="help-step-list">
          <li>
            <strong>ファイル選択:</strong> サイドバー上部の「ファイルを選択」から画像（PNG, JPEG, WebP等）またはPDFファイルを選択します。複数ファイルの一括選択に対応しています。
          </li>
          <li>
            <strong>PDFから画像を自動抽出:</strong> PDFファイルを読み込むと、PDF内部の画像オブジェクトを自動解析・抽出してリストに展開します。
          </li>
          <li>
            <strong>共有ギャラリーから追加:</strong> 左サイドバーの「共有ギャラリー」トレイを開き、保存済み画像の「追加する」ボタンを押すとリストに取り込めます。
          </li>
          <li>
            <strong>自動最適化パイプライン:</strong> 取り込まれた画像は自動的にWebP変換・JPEG圧縮処理が適用され、PDFサイズとメモリ消費を最適化します。
          </li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>2. 並び替え・選択操作</h4>
        <ul className="help-step-list">
          <li>
            <strong>ドラッグ＆ドロップで並び替え:</strong> 画像カードをドラッグして希望のページ順序に並び替えます（タッチ端末では長押しで並び替え可能）。
          </li>
          <li>
            <strong>複数選択と一括移動:</strong> <kbd>Ctrl</kbd>（Mac: <kbd>⌘</kbd>）+ クリックで個別選択、または <kbd>Shift</kbd> + クリックで範囲選択が行えます。選択中の画像をドラッグすると、選択バッジ（個数）が表示され<strong>複数画像をまとめて任意の場所へ一括移動</strong>できます。
          </li>
          <li>
            <strong>名前変更と削除:</strong> カード右上の編集アイコンでファイル名を変更でき、ゴミ箱アイコンで単一画像を削除できます。
          </li>
        </ul>
      </section>

      <section className="help-section-block">
        <h4>3. サイドバーの操作ボタン</h4>
        <div className="help-button-descriptions">
          <div className="help-btn-desc-item">
            <span className="help-btn-tag primary">PDFを生成</span>
            <span>リスト内の全画像を並び順通りに1冊のPDFドキュメントとして結合し、ダウンロードします。</span>
          </div>
          <div className="help-btn-desc-item">
            <span className="help-btn-tag primary">画像を一括DL</span>
            <span>リスト内の全画像をZIPアーカイブ（<code>images.zip</code>）にまとめて一括ダウンロードします。</span>
          </div>
          <div className="help-btn-desc-item">
            <span className="help-btn-tag danger">選択画像削除</span>
            <span>選択状態になっている画像カードをリストからまとめて削除します。</span>
          </div>
          <div className="help-btn-desc-item">
            <span className="help-btn-tag danger">リセット</span>
            <span>リスト内のすべての画像をクリアして初期状態に戻します。</span>
          </div>
        </div>
      </section>
    </div>
  );
}
