import React, { useMemo } from 'react';

export interface ScaleBarProps {
  /** 現在のズーム倍率 */
  zoomLevel: number;
  /** 表示中フラグ（スクロール中のみ true） */
  isVisible: boolean;
}

/**
 * Googleマップスタイルのスケールバーコンポーネント
 * 画面上の幅が約80px程度に収まるようキリの良いピクセル単位（1, 2, 5 × 10^n）を自動選定し、
 * 正確なピクセル寸法を示す目盛りバーを表示します。
 */
export const ScaleBar: React.FC<ScaleBarProps> = ({ zoomLevel, isVisible }) => {
  const { barWidth, label } = useMemo(() => {
    const validZoom = Math.max(zoomLevel || 1, 0.001);
    const targetScreenWidth = 80; // 画面上の目標バー幅（px）
    const targetCanvasPx = targetScreenWidth / validZoom;

    const exponent = Math.floor(Math.log10(targetCanvasPx));
    const base = Math.pow(10, exponent);
    const ratio = targetCanvasPx / base;

    let niceValue: number;
    if (ratio < 1.5) {
      niceValue = 1 * base;
    } else if (ratio < 3.5) {
      niceValue = 2 * base;
    } else if (ratio < 7.5) {
      niceValue = 5 * base;
    } else {
      niceValue = 10 * base;
    }

    const calculatedWidth = Math.max(Math.round(niceValue * validZoom), 10);
    const labelText = niceValue >= 1
      ? `${niceValue.toLocaleString()} px`
      : `${Number(niceValue.toPrecision(2))} px`;

    return {
      barWidth: calculatedWidth,
      label: labelText,
    };
  }, [zoomLevel]);

  return (
    <div
      className={`canvas-scale-bar ${isVisible ? 'is-visible' : ''}`}
      aria-hidden="true"
    >
      <span className="canvas-scale-bar__label">{label}</span>
      <div className="canvas-scale-bar__line" style={{ width: `${barWidth}px` }} />
    </div>
  );
};

export default ScaleBar;
