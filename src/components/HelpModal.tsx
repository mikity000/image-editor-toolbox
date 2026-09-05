import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  FileText,
  Crop,
  Layers,
  Palette,
  FolderPlus,
  Keyboard,
  Info,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { HelpModalProps, HelpSection } from '../types/ui';

const SECTIONS: HelpSection[] = [
  { id: 'intro', label: 'はじめに', icon: BookOpen },
  { id: 'pdf', label: '画像PDF化', icon: FileText, path: '/pdf' },
  { id: 'crop', label: '画像クロップ', icon: Crop, path: '/crop' },
  { id: 'combine', label: '画像結合', icon: Layers, path: '/combine' },
  { id: 'paint', label: 'ペイント', icon: Palette, path: '/paint' },
  { id: 'gallery', label: '共有ギャラリー', icon: FolderPlus },
  { id: 'shortcuts', label: 'ショートカット', icon: Keyboard },
];

export default function HelpModal({ isOpen, onClose, currentPath }: HelpModalProps) {
  // 現在開いている画面タブに合わせて初期タブを決定
  const getInitialSection = (path: string): string => {
    const matched = SECTIONS.find((s) => s.path === path);
    return matched ? matched.id : 'intro';
  };

  const [activeSection, setActiveSection] = useState<string>(() => getInitialSection(currentPath));

  // モーダルが開かれた時に現在の画面に応じたタブを選択
  useEffect(() => {
    if (isOpen) {
      setActiveSection(getInitialSection(currentPath));
    }
  }, [isOpen, currentPath]);

  // Escキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="help-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <div className="help-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* モーダルヘッダー */}
        <div className="help-modal-header">
          <div className="help-modal-header-title">
            <HelpCircle className="help-header-icon" size={24} />
            <h2 id="help-modal-title">ヘルプ ＆ 操作ガイド</h2>
          </div>
          <button className="help-modal-close-btn" onClick={onClose} aria-label="ヘルプを閉じる">
            <X size={20} />
          </button>
        </div>

        {/* モーダルボディ（サイドナビ + コンテンツ） */}
        <div className="help-modal-body">
          {/* 左側ナビゲーション */}
          <nav className="help-modal-nav">
            <ul>
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    className={`help-nav-btn ${activeSection === id ? 'active' : ''}`}
                    onClick={() => setActiveSection(id)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* 右側コンテンツエリア */}
          <main className="help-modal-content">
            {/* はじめに */}
            {activeSection === 'intro' && (
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
            )}

            {/* 画像PDF化 */}
            {activeSection === 'pdf' && (
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
            )}

            {/* 画像クロップ */}
            {activeSection === 'crop' && (
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
            )}

            {/* 画像結合 */}
            {activeSection === 'combine' && (
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
            )}

            {/* ペイント */}
            {activeSection === 'paint' && (
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
            )}

            {/* 共有ギャラリー */}
            {activeSection === 'gallery' && (
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
            )}

            {/* ショートカット */}
            {activeSection === 'shortcuts' && (
              <div className="help-doc-section">
                <div className="help-doc-hero">
                  <div className="help-doc-badge">Shortcuts</div>
                  <h3>キーボードショートカット一覧</h3>
                  <p>作業を効率化するためのショートカットキー一覧です。</p>
                </div>

                <div className="help-shortcut-category">
                  <h4>全画面共通</h4>
                  <div className="help-kbd-table">
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Ctrl</kbd> + <kbd>Z</kbd> (Mac: <kbd>⌘</kbd> + <kbd>Z</kbd>)</div>
                      <div className="help-kbd-desc">直前の操作を元に戻す (Undo)</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></div>
                      <div className="help-kbd-desc">やり直す (Redo)</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Esc</kbd></div>
                      <div className="help-kbd-desc">ヘルプモーダルなどのダイアログを閉じる</div>
                    </div>
                  </div>
                </div>

                <div className="help-shortcut-category">
                  <h4>ペイント画面</h4>
                  <div className="help-kbd-table">
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Shift</kbd> + <kbd>ドラッグ</kbd></div>
                      <div className="help-kbd-desc">ペン / 蛍光ペン / 消しゴムを直線（水平・垂直・45度斜め）で描画・消去</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Alt</kbd> + <kbd>ドラッグ</kbd></div>
                      <div className="help-kbd-desc">キャンバスのパン（画面移動）</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>マウスホイール</kbd></div>
                      <div className="help-kbd-desc">キャンバスのズームイン / ズームアウト</div>
                    </div>
                  </div>
                </div>

                <div className="help-shortcut-category">
                  <h4>画像結合画面</h4>
                  <div className="help-kbd-table">
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Alt</kbd> + <kbd>ドラッグ</kbd> / <kbd>二本指ドラッグ</kbd></div>
                      <div className="help-kbd-desc">キャンバスのパン（画面移動）</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>マウスホイール</kbd> / <kbd>ピンチ</kbd></div>
                      <div className="help-kbd-desc">キャンバスのズームイン / ズームアウト</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Ctrl</kbd> + <kbd>クリック</kbd></div>
                      <div className="help-kbd-desc">オブジェクトの複数選択</div>
                    </div>
                  </div>
                </div>

                <div className="help-shortcut-category">
                  <h4>画像PDF化画面</h4>
                  <div className="help-kbd-table">
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Shift</kbd> + <kbd>クリック</kbd></div>
                      <div className="help-kbd-desc">画像カードの範囲選択</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Ctrl</kbd> + <kbd>クリック</kbd> (Mac: <kbd>⌘</kbd> + <kbd>クリック</kbd>)</div>
                      <div className="help-kbd-desc">画像カードの個別複数選択</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* モーダルフッター */}
        <div className="help-modal-footer">
          <div className="help-footer-tip">
            <Sparkles size={16} />
            <span>キーボードの <kbd>Esc</kbd> キーでも閉じられます</span>
          </div>
          <button className="btn btn--secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
