/**
 * アプリケーション全体・共通設定
 */
export const APP_CONFIG = Object.freeze({
  MAX_HISTORY_STACK: 30, // Undo/Redo の履歴保持上限
  STORAGE_KEYS: Object.freeze({
    GALLERY_IMAGES: 'galleryImages',
    GALLERY_VIEW_MODE: 'galleryViewMode',
    LIST_VIEW_MODE: 'listViewMode',
  }),
} as const);

/**
 * WebP変換・画像処理関連設定
 */
export const IMAGE_CONFIG = Object.freeze({
  DEFAULT_WEBP_QUALITY: 85, // WebP変換時のデフォルト品質
  WEBP_WORKER_TIMEOUT_MS: 15000, // Web Worker通信のタイムアウト（ms）
  MAX_EXPORT_PIXELS: 4096, // エクスポート時の最大解像度ピクセル
} as const);

/**
 * 画像PDF化画面設定
 */
export const PDF_CONFIG = Object.freeze({
  PAGE_WIDTH_A4: 595.28, // A4幅 (約210mm) のPDFポイント (72dpi換算)
  DEFAULT_WEBP_QUALITY: 85,
  UI_YIELD_INTERVAL: 3, // メインスレッド解放を行うバッチ間隔
} as const);

/**
 * 画像結合画面設定
 */
export const COMBINE_CONFIG = Object.freeze({
  TARGET_SCREEN_SIZE: 60, // グリッド線の基準画面ピクセルサイズ
  ZOOM_MIN: 0.01, // 最小ズーム倍率
  ZOOM_MAX: 10, // 最大ズーム倍率
  GUIDE_THICKNESS_DEFAULT: 1, // ガイドライン太さの初期値
  GUIDE_THICKNESS_MIN: 1, // ガイドライン太さの最小値
  GUIDE_THICKNESS_MAX: 20, // ガイドライン太さの最大値
} as const);

/**
 * 画像クロップ画面設定
 */
export const CROP_CONFIG = Object.freeze({
  VERTEX_HIT_PADDING: 3, // 頂点の当たり判定パディング
  SNAP_RADIUS: 5, // マグネット吸着探索半径
  MAGNETIC_THRESHOLD_DEFAULT: 50, // マグネット吸着感度の初期値
  MAGNETIC_THRESHOLD_MIN: 10, // マグネット吸着感度の最小値
  MAGNETIC_THRESHOLD_MAX: 150, // マグネット吸着感度の最大値
  VERTEX_INSERT_DISTANCE: 3, // 頂点挿入可能距離
  VERTEX_SELECT_RADIUS: 20, // プレビュー頂点クリック選択の許容距離
  PATH_SMOOTHING_DEFAULT: 20, // フリーハンド曲線の滑らかさ初期値
  PATH_SMOOTHING_MIN: 0, // フリーハンド曲線の滑らかさ最小値
  PATH_SMOOTHING_MAX: 50, // フリーハンド曲線の滑らかさ最大値
  MIN_SHAPE_SIZE: 10, // クロップ図形の最小サイズ（幅・高さ）
} as const);

export interface ColorPaletteItem {
  color: string;
  label: string;
}

/**
 * ペイント画面設定
 */
export const PAINT_CONFIG = Object.freeze({
  DEFAULT_COLOR: '#000000',
  DEFAULT_BRUSH_SIZE: 20,
  MIN_BRUSH_SIZE: 1,
  MAX_BRUSH_SIZE: 50,
  HIGHLIGHTER_OPACITY: 0.5,
  DEFAULT_TOLERANCE: 100, // バケツ塗りつぶしの許容度 (1〜100%)
  DEFAULT_SMART_TOLERANCE: 100, // スマート輪郭抽出の感度 (1〜100%)
  DEFAULT_FILL_OPACITY: 100, // 塗りつぶしの不透明度 (10〜100%)
  FLOOD_FILL_EXPAND_RADIUS: 1, // バケツ塗りつぶしのアンチエイリアス隙間埋め膨張半径 (px)
  SMART_FILL_EXPAND_RADIUS: 1, // スマート塗りつぶしの隙間・輪郭キワ埋め膨張半径 (px)
  SMART_FILL_STROKE_RADIUS: 1.0, // スマート塗りつぶしの輪郭ペン線半径 (px)
  STROKE_WALL_ALPHA_THRESHOLD: 80, // 手書きストロークを壁とみなすアルファ閾値 (0〜255)
  DEFAULT_GAP_CLOSING: 0, // 隙間閉じ許容幅の初期値 (px)
  MIN_GAP_CLOSING: 0, // 隙間閉じ最小値 (0 = 隙間閉じ無効)
  MAX_GAP_CLOSING: 10, // 隙間閉じ最大値 (px)
  SHIFT_LOCK_THRESHOLD: 20, // Shift直線で軸ロックするまでの有意な移動距離 (px)
  COLOR_PALETTE: [
    // モノトーン・ベーシック
    { color: '#000000', label: 'ブラック' },
    { color: '#ffffff', label: 'ホワイト' },
    { color: '#6b7280', label: 'グレー' },
    { color: '#78350f', label: 'ブラウン' },
    // ビビッドカラー（基本色）
    { color: '#FF0000', label: 'レッド' },
    { color: '#FF8000', label: 'オレンジ' },
    { color: '#FFFF00', label: 'イエロー' },
    { color: '#00FF00', label: 'グリーン' },
    { color: '#00FFFF', label: 'シアン' },
    { color: '#0000FF', label: 'ブルー' },
    { color: '#8000FF', label: 'パープル' },
    { color: '#FF00FF', label: 'ピンク' },
    // パステル・ソフトカラー
    { color: '#fca5a5', label: 'パステルレッド' },
    { color: '#fdba74', label: 'パステルオレンジ' },
    { color: '#fef08a', label: 'パステルイエロー' },
    { color: '#86efac', label: 'パステルグリーン' },
    { color: '#67e8f9', label: 'パステルシアン' },
    { color: '#93c5fd', label: 'パステルブルー' },
    { color: '#c4b5fd', label: 'パステルパープル' },
    { color: '#f472b6', label: 'パステルピンク' },
  ],
} as const);
