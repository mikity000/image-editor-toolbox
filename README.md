# 高機能画像編集ツールボックス (Image Editor Toolbox)

このプロジェクトは、Webブラウザ上で高度な画像編集を実現するためのReactコンポーネント群です。以下の3つの主要機能を中心に、強力なクライアントサイド画像処理と協調作業機能を提供します。

1.  **画像クロップ機能:** 四角形や円形に加え、多角形やフリーハンドなど自由な形状での切り抜きに対応。輪郭検出による自動吸着機能も統合されています。
2.  **PDF生成・抽出機能:** 複数の画像をPDFに変換するだけでなく、既存のPDFファイルから画像を抽出してインポートしたり、画像をZIPにまとめて一括ダウンロードしたりできます。
3.  **画像結合機能:** ズーム・パンに対応した無限ライクなキャンバス上に画像を自由に配置・合成し、自動余白トリミングを行った上で1枚 of 画像として出力します。

すべての主要機能は、[GalleryContext](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/context/GalleryContext.js) による**共有ギャラリー**を介して相互に連携でき、さらに `Socket.IO` を利用した**リアルタイム同期機能**によって、複数ユーザー間での共同編集作業が可能です。

---

## ① 主な特徴

* **多機能なインブラウザ編集:** すべての画像編集、PDF生成、画像抽出、ZIP生成処理がクライアントサイドのブラウザ上で完結します。
* **クライアントサイド画像最適化:** Web Worker と `@jsquash/webp` を組み合わせ、メインスレッドをブロックすることなく高品質な WebP 変換を行います。データ転送量とメモリ使用量を劇的に節約します。
* **高度な操作インタラクション:** ズーム、パン、オブジェクト間の吸着（スナップガイド）、Undo/Redoなど、デスクトップアプリに近い快適な編集体験を提供します。
* **リアルタイム共同編集:** `Socket.IO` を通じ、キャンバスや画像リストの状態を瞬時に同期。大容量データ送信時は自動でチャンク（分割）転送を行います。
* **モバイルフレンドリー設計:** タッチスクリーン端末でのピンチズームや二本指によるドラッグ（パン）、長押しを考慮したドラッグ＆ドロップに対応しています。

---

## ② 機能詳細

### 1. 画像クロップ機能 ([CropperComponent.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/components/CropperComponent.js))

指定した画像から、元画像のフル解像度を維持したまま精密に切り抜くためのコンポーネントです。

* **自由度の高いクロップ形状:**
  * `四角形 (Rect)`、`円・楕円 (Circle/Ellipse)`
  * 任意の頂点数を指定して囲む `多角形 (Polygon)`
  * マウスやタッチ操作で自由に描画する `フリーハンド (Path)`
* **マグネットモード（エッジ吸着）:**
  * Sobelフィルタを用いたリアルタイム輪郭検出([edgeDetection.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/utils/edgeDetection.js))により、マウスカーソルが物体の境界線に近づくと、頂点を自動的にエッジへ吸着させます。
* **精密な調整機能:**
  * クロップ枠の移動・スケーリングを背景画像の境界内に自動制限します。
  * 選択中の頂点を1px単位で微調整・追加・削除できます。
  * パス（フリーハンド）の描画時には、設定に応じたスムージング（デシメーション）を適用可能です。
* **反転クロップ:**
  * クロップ範囲の内側ではなく、**選択範囲の外側を切り抜く（マスクする）**設定が可能です。
* **高解像度エクスポート:**
  * 表示用の縮小表示に影響されず、オフスクリーンの Fabric キャンバスを用いて元画像のオリジナル解像度でクロップ処理を施し、画質の劣化を防ぎます。
* **ギャラリー連携・書き出し:**
  * 切り抜いた画像をPNG/WebP形式でダウンロード、または「共有ギャラリー」へ直接保存できます。

### 2. PDF生成・抽出機能 ([PdfComponent.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/components/PdfComponent.js))

複数の画像を並べ替えてPDF化する機能に加え、PDFから画像を取り出す双方向のドキュメント画像ツールです。

* **PDFインポート（画像抽出）:**
  * 既存のPDFファイルを選択すると、`pdf-lib` を用いてPDF内部の画像オブジェクト（`Subtype: Image`）を解析し、自動的に画像として抽出して編集リストに展開します ([usePdfExtractor.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/hooks/usePdfExtractor.js))。
* **画像ZIP一括ダウンロード:**
  * リスト内の全画像を、`jszip` を使ってブラウザ上でZIPアーカイブファイル（`images.zip`）にまとめてダウンロードできます。
* **ドラッグ＆ドロップによる並べ替え:**
  * `@dnd-kit` を使用し、直感的な並べ替えに対応。
  * **複数選択状態での一括ドラッグ＆ドロップ**に対応しており、選択した画像をまとめて任意の場所へ移動できます。
* **画像自動最適化・圧縮:**
  * アップロードされた画像を自動的にWebPへ変換後、適切な解像度・品質制限を考慮したJPEG圧縮を行い、PDF生成やメモリ消費を最適化します。
* **進捗フィードバック:**
  * 画像アップロード、PDFからの画像抽出、PDF生成、ZIP圧縮の各プロセスで、処理進捗をパーセンテージで視覚的に表示します。

### 3. 画像結合機能 ([CombinerComponent.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/components/CombinerComponent.js))

複数の画像をキャンバス上にコラージュし、独自のレイアウト・デザインを作成するための多機能キャンバスツールです。

* **動的グリッド表示 (マス目):**
  * ズーム倍率に応じて適切なサイズに自動スケーリングする背景グリッド線を描画。編集時の正確な配置をサポートします（エクスポート時には自動で非表示になります）。
* **スナップ＆スマートガイドライン:**
  * 画像オブジェクトの移動・スケーリング時、他のオブジェクトの境界線や中心線に近づくと自動的にスナップします([useSnappingGuides.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/hooks/useSnappingGuides.js))。
  * 吸着時には整列基準を示す**赤いガイドライン**が動的に描画されます（ガイドラインの太さはスライダーで調整可能）。
* **レイヤー順序操作:**
  * オブジェクトの重なり順（最前面・最背面・前面・背面）をワンクリックで自在に変更可能です。
* **無限Undo/Redo:**
  * キャンバス上のオブジェクトの追加、削除、移動、サイズ変更、レイヤー変更などの操作履歴をスタックし、元に戻す・やり落すことができます。
* **余白自動トリミングエクスポート:**
  * キャンバスの全領域ではなく、配置された画像オブジェクト群が占める**最小矩形領域（余白なし領域）**を動的に計算し、不要な余白を完全にカットしてWebP画像としてエクスポートします。
* **ナビゲーションとUI補助:**
  * 選択オブジェクトの幅・高さをリアルタイム表示。
  * キャンバス全体のズーム倍率をリアルタイム表示。
  * キャンバス外の画像リストをクリックすると、対象の画像がキャンバスの中央に表示されるようビューポートが自動スクロール（フォーカス）します。

---

## ③ アーキテクチャと共通機能

### 共有ギャラリー ([GalleryContext.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/context/GalleryContext.js))
React の Context API を用いた状態管理システムです。各画面で編集した画像やPDFから抽出した画像を一時保存する「共有ギャラリー」を司ります。グリッドビューとリストビューの切り替え情報を `localStorage` に保持します。

### リアルタイム同期 ([syncService.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/syncService.js))
Socket.IOクライアントを利用した共同編集のための同期エンジンです。
* **シリアライズと復元:**
  Fabric.jsのキャンバスオブジェクト情報（背景、各画像のスケール、回転、座標、ソースなど）を軽量なJSONデータに変換・再構築します。
* **チャンク（分割）送信:**
  データ量がソケット通信の制限を超えないよう、大きなJSONファイルを約900KBのチャンクに自動で分割・シリアライズして送信し、受信側で再結合します。

### WebP変換最適化 ([webpConverter.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/utils/webpConverter.js) / [webp.worker.js](file:///c:/Users/Furumichi/Works/image-editor-toolbox/src/utils/webp.worker.js))
Web Worker を用いてバックグラウンドで `@jsquash/webp` を実行する仕組みです。ImageDataのバッファを Transferable オブジェクトとして転送することで、UI（メインスレッド）を一切フリーズさせることなく高速な高品質WebP変換を実現します。

---

## ④ 技術スタック

* **フロントエンド:** [React v19](https://react.dev/) / [React Router v7](https://reactrouter.com/)
* **グラフィック・キャンバス制御:** [Fabric.js v6](http://fabricjs.com/)
* **PDF操作:** [pdf-lib](https://pdf-lib.js.org/)
* **ドラッグ＆ドロップ制御:** [@dnd-kit](https://dndkit.com/) (Core, Sortable, Modifiers)
* **画像最適化 (WebP):** [@jsquash/webp](https://github.com/GoogleChromeLabs/jsquash)
* **画像圧縮 (JPEG):** [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression)
* **アーカイブ生成:** [JSZip](https://stuk.github.io/jszip/)
* **ファイルダウンロード保存:** [file-saver](https://github.com/eligrey/FileSaver.js/)
* **リアルタイム通信:** [Socket.IO](https://socket.io/) (v4)
