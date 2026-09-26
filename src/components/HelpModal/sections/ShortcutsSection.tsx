import React from 'react';

export default function ShortcutsSection(): React.ReactElement {
  return (
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
  );
}
