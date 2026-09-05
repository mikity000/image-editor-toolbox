/**
 * アプリケーション共通の幾何・基本型定義
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
