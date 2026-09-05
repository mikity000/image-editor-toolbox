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
                    <p>複数画像をPDFに一括変換。既存PDFからの画像抽出やZIP一括ダウンロードにも対応。</p>
                  </div>
                  <div className="help-feature-card">
                    <div className="help-card-icon"><Crop size={22} /></div>
                    <h4>画像クロップ</h4>
                    <p>矩形、円形、多角形、フリーハンドでの切り抜き。境界輪郭への自動吸着（マグネット）機能付き。</p>
                  </div>
                  <div className="help-feature-card">
                    <div className="help-card-icon"><Layers size={22} /></div>
                    <h4>画像結合</h4>
                    <p>無限ライクなキャンバス上で自由に画像を配置・結合。スマートガイドと余白自動トリミングを搭載。</p>
                  </div>
                  <div className="help-feature-card">
                    <div className="help-card-icon"><Palette size={22} /></div>
                    <h4>ペイント</h4>
                    <p>画像やPDF上にペン・蛍光ペン・直線スナップ・スマート塗りつぶしで書き込み・編集。</p>
                  </div>
                </div>

                <div className="help-info-box">
                  <Info size={20} />
                  <div>
                    <strong>共有ギャラリーで画面連携</strong>
                    <p>クロップや抽出、結合、ペイントで作成した画像は「共有ギャラリー」を通じて各画面へワンクリックで受け渡すことができます。</p>
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
                  <p>複数の画像をひとつのPDFにまとめたり、PDFファイルから画像を抽出・編集できます。</p>
                </div>

                <section className="help-section-block">
                  <h4>1. 画像・PDFの追加と読み込み</h4>
                  <ul className="help-step-list">
                    <li>
                      <strong>ファイル選択:</strong> サイドバーの「ファイルを選択」から画像（PNG, JPEG, WebP等）またはPDFファイルを選択します。
                    </li>
                    <li>
                      <strong>PDFから画像を自動抽出:</strong> PDFファイルを指定すると、内部に含まれる画像オブジェクトを自動解析・抽出してリストに展開します。
                    </li>
                    <li>
                      <strong>共有ギャラリーから追加:</strong> 左サイドバーの共有ギャラリーから登録済み画像を直接取り込むこともできます。
                    </li>
                  </ul>
                </section>

                <section className="help-section-block">
                  <h4>2. 画像の並び替え・選択操作</h4>
                  <ul className="help-step-list">
                    <li>
                      <strong>ドラッグ＆ドロップで並び替え:</strong> 画像カードをドラッグして希望のページ順序に並び替えます（タッチ端末では長押しで並び替え）。
                    </li>
                    <li>
                      <strong>複数選択と一括移動:</strong> 画像カードをクリックして複数選択状態にすると、まとめてドラッグ＆ドロップで順序移動できます。
                    </li>
                    <li>
                      <strong>名前変更と削除:</strong> カード右上の編集アイコンで名前変更、ゴミ箱アイコンでリストから削除できます。
                    </li>
                  </ul>
                </section>

                <section className="help-section-block">
                  <h4>3. エクスポート</h4>
                  <div className="help-button-descriptions">
                    <div className="help-btn-desc-item">
                      <span className="help-btn-tag primary">PDF作成</span>
                      <span>リスト内の画像を1冊のPDFドキュメントとして結合し、ダウンロードします。</span>
                    </div>
                    <div className="help-btn-desc-item">
                      <span className="help-btn-tag secondary">ZIPダウンロード</span>
                      <span>リスト内の全画像をZIPアーカイブファイルにまとめて一括ダウンロードします。</span>
                    </div>
                    <div className="help-btn-desc-item">
                      <span className="help-btn-tag success">共有ギャラリーに保存</span>
                      <span>選択中の画像（または全画像）をアプリ内共有ギャラリーに保存します。</span>
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
                  <p>画像から必要な部分を自由な形状で精密に切り抜きます。エッジ検出による自動吸着にも対応しています。</p>
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
                      <p>マウスやペンでなぞって描いた自由な軌跡で切り抜きます。滑らかさスライダーで補正可能。</p>
                    </div>
                  </div>
                </section>

                <section className="help-section-block">
                  <h4>2. 多角形クロップと吸着（マグネット）モード</h4>
                  <ul className="help-step-list">
                    <li>
                      <strong>頂点の追加:</strong> 画像上をクリックしていくと頂点と線が結ばれます。
                    </li>
                    <li>
                      <strong>吸着モード（マグネット）:</strong> 吸着モードを有効にすると、物体の境界線（輪郭）にマウスカーソルが近づいた際、頂点が自動的にエッジに吸着します。感度スライダーで強さを調整できます。
                    </li>
                    <li>
                      <strong>描画完了:</strong> 「描画完了」ボタンを押すと形状が確定し、自動的にクロップ結果が生成されます。
                    </li>
                    <li>
                      <strong>頂点の微調整・削除・再編集:</strong> 確定後も「頂点を再編集」ボタンで頂点の位置を上下左右ボタンで1px単位で微調整したり、不要な頂点を削除できます。
                    </li>
                  </ul>
                </section>

                <section className="help-section-block">
                  <h4>3. 便利な機能</h4>
                  <ul className="help-step-list">
                    <li>
                      <strong>外側を切り取る（反転クロップ）:</strong> チェックを入れると、選択範囲の内側を残すのではなく、選択範囲をくり抜いて外側を残します。
                    </li>
                    <li>
                      <strong>高解像度エクスポート:</strong> 画面上の表示サイズにかかわらず、元画像のオリジナル解像度を保持したまま切り抜かれます。
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
                      <strong>変形と回転:</strong> キャンバス上の画像をクリックすると枠（バウンディングボックス）が表示され、四隅をドラッグして拡大縮小、上部のハンドルで回転できます。
                    </li>
                    <li>
                      <strong>スナップ＆スマートガイド:</strong> 画像を動かすと、他の画像のエッジや中心に合わせて自動的に吸着し、赤い整列ガイドラインが表示されます。
                    </li>
                    <li>
                      <strong>レイヤー順序:</strong> 重なり順を「最前面」「前面」「背面」「最背面」に変更できます。
                    </li>
                  </ul>
                </section>

                <section className="help-section-block">
                  <h4>3. 余白自動トリミングエクスポート</h4>
                  <p>
                    「結合画像を保存」を実行すると、キャンバス全体の広大な余白は自動で切り落とされ、<strong>配置されている画像群が占める最小の領域だけがぴったりトリミングされた1枚の高画質WebP画像</strong>としてエクスポートされます。
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
                  <p>画像やPDFドキュメント上に直接ペンで書き込んだり、注釈や塗りつぶしを行えます。</p>
                </div>

                <section className="help-section-block">
                  <h4>1. ツール一覧と使い方</h4>
                  <div className="help-tool-grid">
                    <div className="help-tool-item">
                      <strong>✏️ ペン</strong>
                      <p>滑らかな線を描画。<kbd>Shift</kbd> キーを押しながらドラッグすると直線（水平・垂直・45度斜め）をリアルタイムに描画できます。</p>
                    </div>
                    <div className="help-tool-item">
                      <strong>🖍️ 蛍光ペン</strong>
                      <p>下の文字や画像が透ける半透明のハイライト描画。<kbd>Shift</kbd> キーで直線引きに対応。</p>
                    </div>
                    <div className="help-tool-item">
                      <strong>🧹 消しゴム</strong>
                      <p>
                        「ストローク消去（線全体を1本丸ごと消去）」と「ピクセル消去（なぞった部分だけ削る）」の2モードを搭載。
                      </p>
                    </div>
                    <div className="help-tool-item">
                      <strong>🪣 バケツ塗りつぶし</strong>
                      <p>手書き線や枠線で囲まれた閉じたエリアの内側をクリックして均一に塗りつぶします。</p>
                    </div>
                    <div className="help-tool-item">
                      <strong>✨ スマート塗りつぶし</strong>
                      <p>画像内の人物や服、物体をクリックすると、輪郭境界を自動認識してぴったり塗りつぶします。</p>
                    </div>
                    <div className="help-tool-item">
                      <strong>🧪 スポイト</strong>
                      <p>キャンバス上をクリックして、その場所のピクセル色をすばやく抽出します。</p>
                    </div>
                  </div>
                </section>

                <section className="help-section-block">
                  <h4>2. PDFの注釈と複数ページ対応</h4>
                  <p>
                    PDFファイルを読み込んだ場合、画面右上の「◀ / ▶」ページ送りボタンで各ページを切り替えながら、個別のページごとに書き込みを行うことができます。保存時には「PDFとして保存」で全ページをまとめて出力可能です。
                  </p>
                </section>

                <section className="help-section-block">
                  <h4>3. ズーム＆パン操作</h4>
                  <p>
                    画面右下のフローティングズームバー（＋ / － / リセット）や、<kbd>マウスホイール</kbd>での拡大縮小、<kbd>Alt</kbd> ＋ドラッグでの画面移動に対応しています。
                  </p>
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
                    <li>ペイント画面でギャラリーから読み込んで注釈を追加</li>
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
                      <strong>表示切り替え:</strong> グリッド（サムネイル一覧）とリスト表示を切り替え可能。設定はブラウザに記憶されます。
                    </li>
                    <li>
                      <strong>名前変更・削除:</strong> アイテムの名前変更や不要な画像の削除を行えます。
                    </li>
                  </ul>
                </section>

                <section className="help-section-block">
                  <h4>3. テーマ切り替え</h4>
                  <p>
                    ヘッダー右上の太陽 / 月アイコンをクリックすると、ダークテーマとライトテーマを瞬時に切り替えられます。作業環境やお好みに応じてご利用ください。
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
                      <div className="help-kbd-desc">ズームイン / ズームアウト</div>
                    </div>
                  </div>
                </div>

                <div className="help-shortcut-category">
                  <h4>画像結合画面</h4>
                  <div className="help-kbd-table">
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>Alt</kbd> + <kbd>ドラッグ</kbd></div>
                      <div className="help-kbd-desc">キャンバスのパン（画面移動）</div>
                    </div>
                    <div className="help-kbd-row">
                      <div className="help-kbd-key"><kbd>マウスホイール</kbd></div>
                      <div className="help-kbd-desc">ズームイン / ズームアウト</div>
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
