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
});

/**
 * WebP変換・画像処理関連設定
 */
export const IMAGE_CONFIG = Object.freeze({
  DEFAULT_WEBP_QUALITY: 85, // WebP変換時のデフォルト品質
  WEBP_WORKER_TIMEOUT_MS: 15000, // Web Worker通信のタイムアウト（ms）
  MAX_EXPORT_PIXELS: 4096, // エクスポート時の最大解像度ピクセル
});

/**
 * 画像PDF化画面設定
 */
export const PDF_CONFIG = Object.freeze({
  PAGE_WIDTH_A4: 595.28, // A4幅 (約210mm) のPDFポイント (72dpi換算)
  DEFAULT_WEBP_QUALITY: 85,
  UI_YIELD_INTERVAL: 3, // メインスレッド解放を行うバッチ間隔
});

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
});

/**
 * 画像クロップ画面設定
 */
export const CROP_CONFIG = Object.freeze({
  VERTEX_HIT_PADDING: 10, // 頂点の当たり判定パディング
  SNAP_RADIUS: 30, // マグネット吸着探索半径
  MAGNETIC_THRESHOLD_DEFAULT: 50, // マグネット吸着感度の初期値
  MAGNETIC_THRESHOLD_MIN: 10, // マグネット吸着感度の最小値
  MAGNETIC_THRESHOLD_MAX: 150, // マグネット吸着感度の最大値
  VERTEX_INSERT_DISTANCE: 15, // 頂点挿入可能距離
  VERTEX_SELECT_RADIUS: 20, // 頂点クリック選択の許容距離
  PATH_SMOOTHING_DEFAULT: 20, // フリーハンド曲線の滑らかさ初期値
  PATH_SMOOTHING_MIN: 0, // フリーハンド曲線の滑らかさ最小値
  PATH_SMOOTHING_MAX: 50, // フリーハンド曲線の滑らかさ最大値
  MIN_SHAPE_SIZE: 10, // クロップ図形の最小サイズ（幅・高さ）
});



