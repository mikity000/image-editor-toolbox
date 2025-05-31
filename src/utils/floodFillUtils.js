/**
 * 塗りつぶし画像処理エンジン
 * 1. スキャンライン Flood Fill（バケツツール: 手書き線・閉曲線の塗りつぶし）
 * 2. スマートオブジェクト輪郭抽出塗りつぶし（エッジ勾配解析＋色差適応型領域成長法）
 * 3. モルフォロジー閉処理による全メディア（手書き・画像・PDF）対応の隙間閉じエンジン
 */
import { PAINT_CONFIG } from '../constants/Constants';

/**
 * HEXカラー文字列を RGBA オブジェクトに変換します。
 * @param {string} hex '#RRGGBB' または '#RGB'
 * @param {number} alpha 0.0 〜 1.0 (デフォルト 1.0)
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function hexToRgba(hex, alpha = 1.0) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: Math.round(Math.max(0, Math.min(1, alpha)) * 255),
  };
}

/**
 * 2つのRGBAピクセル間の色差（ユークリッド距離）を計算します。
 */
function colorDistance(r1, g1, b1, a1, r2, g2, b2, a2) {
  if (Math.abs(a1 - a2) > 60) return 255;
  if (a1 < 10 && a2 < 10) return 0;

  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114);
}

/**
 * 背景Canvas (bgCanvas) の ImageData を取得します。
 */
function getBgImageData(bgCanvas, width, height) {
  if (bgCanvas) {
    const ctx = bgCanvas.getContext('2d', { willReadFrequently: true });
    return ctx.getImageData(0, 0, width, height);
  }
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  return ctx.getImageData(0, 0, width, height);
}

/**
 * 汎用スキャンライン Flood Fill 探索エンジン
 * @param {number} width 幅
 * @param {number} height 高さ
 * @param {number} startX 開始X座標
 * @param {number} startY 開始Y座標
 * @param {(x: number, y: number) => boolean} isMatchFn 通過判定コールバック
 * @param {Uint8Array} [initialVisited] 初期訪問済みマップ (省略時は新規作成)
 * @returns {Uint8Array} 塗りつぶし領域マスク
 */
export function runScanlineFill(width, height, startX, startY, isMatchFn, initialVisited = null) {
  const mask = new Uint8Array(width * height);
  const visited = initialVisited || new Uint8Array(width * height);

  if (!isMatchFn(startX, startY)) return mask;

  const stack = [[startX, startY]];
  visited[startY * width + startX] = 1;

  while (stack.length > 0) {
    const [curX, curY] = stack.pop();

    let left = curX;
    let right = curX;

    // 左方向走査
    while (left > 0) {
      const prevX = left - 1;
      const pos = curY * width + prevX;
      if (visited[pos] || !isMatchFn(prevX, curY)) break;
      left--;
    }

    // 右方向走査
    while (right < width - 1) {
      const nextX = right + 1;
      const pos = curY * width + nextX;
      if (visited[pos] || !isMatchFn(nextX, curY)) break;
      right++;
    }

    // 現在のスキャンラインをマーク
    for (let scanX = left; scanX <= right; scanX++) {
      const pos = curY * width + scanX;
      visited[pos] = 1;
      mask[pos] = 1;
    }

    // 上下スキャンラインの探索スパン検出
    const checkLine = (checkY) => {
      if (checkY < 0 || checkY >= height) return;
      let inSpan = false;
      for (let scanX = left; scanX <= right; scanX++) {
        const pos = checkY * width + scanX;
        const match = !visited[pos] && isMatchFn(scanX, checkY);

        if (match && !inSpan) {
          stack.push([scanX, checkY]);
          inSpan = true;
        } else if (!match && inSpan) {
          inSpan = false;
        }
      }
    };

    checkLine(curY - 1);
    checkLine(curY + 1);
  }

  return mask;
}

/**
 * マスク（Uint8Array）を指定ピクセル数（ユークリッド距離）だけ膨張させます。
 * @param {Uint8Array} mask 塗りつぶしマスク
 * @param {number} width 幅
 * @param {number} height 高さ
 * @param {number} radius 膨張半径
 * @returns {Uint8Array} 膨張後のマスク
 */
export function expandMask(mask, width, height, radius) {
  if (radius <= 0) return mask;

  const expanded = new Uint8Array(mask.length);
  expanded.set(mask);

  const rCeil = Math.ceil(radius);
  const rSquared = radius * radius;

  // 境界ピクセル（maskが1で、4近傍のいずれかが0のピクセル）を抽出
  const borderPixels = [];
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (mask[idx] === 1) {
        if (
          x === 0 ||
          x === width - 1 ||
          y === 0 ||
          y === height - 1 ||
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - width] === 0 ||
          mask[idx + width] === 0
        ) {
          borderPixels.push(x, y);
        }
      }
    }
  }

  // 境界ピクセルから周囲を真円で膨張
  const numBorderPixels = borderPixels.length;
  for (let i = 0; i < numBorderPixels; i += 2) {
    const bx = borderPixels[i];
    const by = borderPixels[i + 1];

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      const ny = by + dy;
      if (ny < 0 || ny >= height) continue;
      const dy2 = dy * dy;
      const rowOffset = ny * width;

      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dy2 <= rSquared) {
          const nx = bx + dx;
          if (nx >= 0 && nx < width) {
            expanded[rowOffset + nx] = 1;
          }
        }
      }
    }
  }

  return expanded;
}

/**
 * マスク（Uint8Array）を指定ピクセル数（ユークリッド距離）だけ収縮させます。
 * @param {Uint8Array} mask 塗りつぶしマスク
 * @param {number} width 幅
 * @param {number} height 高さ
 * @param {number} radius 収縮半径
 * @returns {Uint8Array} 収縮後のマスク
 */
export function erodeMask(mask, width, height, radius) {
  if (radius <= 0) return mask;

  // モルフォロジー双対性: Erode(M, r) = NOT( Expand( NOT(M), r ) )
  const len = width * height;
  const inverted = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    inverted[i] = mask[i] === 0 ? 1 : 0;
  }

  const expandedInverted = expandMask(inverted, width, height, radius);

  const eroded = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    eroded[i] = expandedInverted[i] === 0 ? 1 : 0;
  }

  return eroded;
}

/**
 * モルフォロジー閉処理 (Dilation + Erosion) により、開口部・途切れのみを塞ぎ、線の太さを元に復元します。
 * @param {Uint8Array} mask 元のバリアマスク
 * @param {number} width 幅
 * @param {number} height 高さ
 * @param {number} radius 閉処理半径 (gapClosing / 2)
 * @returns {Uint8Array} 隙間のみが塞がれたバリアマスク
 */
export function closeMask(mask, width, height, radius) {
  if (radius <= 0) return mask;

  // 1. 膨張 (Dilation): 隙間をつなぐ
  const dilated = expandMask(mask, width, height, radius);

  // 2. 収縮 (Erosion): 線幅を元の太さに復元する
  const eroded = erodeMask(dilated, width, height, radius);

  // 3. 元のバリアと合成（元の線が削られるのを防ぎ、かつ接続された開口部のみを保持）
  const len = width * height;
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = mask[i] === 1 || eroded[i] === 1 ? 1 : 0;
  }

  return result;
}

/**
 * 手書き線・画像・PDFの全境界を統合し、隙間（gapClosing px）を塞いだバリアマップを生成します。
 * モルフォロジー閉処理（Dilation + Erosion）を用いて、線の周囲を太くすることなく距離 gapClosing 以内の開口部のみを接続します。
 * @param {Uint8ClampedArray} pData 手書きレイヤーのピクセルデータ
 * @param {Uint8ClampedArray} [bgData] 背景画像/PDFのピクセルデータ
 * @param {number} width 幅
 * @param {number} height 高さ
 * @param {number} gapClosing 隙間閉じ許容幅 (px)
 * @returns {Uint8Array} 隙間が塞がれた境界バリアマップ (1: 壁, 0: 通過可能)
 */
function createClosedBarrierMap(pData, bgData, width, height, gapClosing) {
  const wallAlpha = PAINT_CONFIG.STROKE_WALL_ALPHA_THRESHOLD;
  const rawBarrier = new Uint8Array(width * height);

  // 1. 手書きストロークおよび背景線のバリア抽出
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = (rowOffset + x) * 4;

      // 手書きストローク
      if (pData && pData[idx + 3] >= wallAlpha) {
        rawBarrier[rowOffset + x] = 1;
        continue;
      }

      // 背景画像・PDFの線画・エッジ（Sobel勾配または濃い輪郭線）
      if (bgData && x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        // グレースケール輝度による急峻なエッジ検出
        const getLum = (px, py) => {
          const pIdx = (py * width + px) * 4;
          return bgData[pIdx] * 0.299 + bgData[pIdx + 1] * 0.587 + bgData[pIdx + 2] * 0.114;
        };

        const gx =
          -getLum(x - 1, y - 1) + getLum(x + 1, y - 1) -
          2 * getLum(x - 1, y) + 2 * getLum(x + 1, y) -
          getLum(x - 1, y + 1) + getLum(x + 1, y + 1);

        const gy =
          -getLum(x - 1, y - 1) - 2 * getLum(x, y - 1) - getLum(x + 1, y - 1) +
          getLum(x - 1, y + 1) + 2 * getLum(x, y + 1) + getLum(x + 1, y + 1);

        if (Math.hypot(gx, gy) >= 35) {
          rawBarrier[rowOffset + x] = 1;
        }
      }
    }
  }

  if (gapClosing <= 0) return rawBarrier;

  // 2. 隙間閉じ（Gap Closing）: モルフォロジー閉処理（Dilation + Erosion）
  // 線全体を太くすることなく、開口部（gapClosing px以内の切れ目）のみを接続
  const radius = gapClosing / 2;
  return closeMask(rawBarrier, width, height, radius);
}

/**
 * 手書き線・図形の塗りつぶし (Scanline Flood Fill ＋ 隙間閉じ機能)
 */
export function performFloodFill(
  bgCanvas,
  paintCanvas,
  startX,
  startY,
  fillColor,
  tolerancePercent = 25,
  opacityPercent = 100,
  expandRadius = PAINT_CONFIG.FLOOD_FILL_EXPAND_RADIUS,
  gapClosing = PAINT_CONFIG.DEFAULT_GAP_CLOSING
) {
  const width = paintCanvas.width;
  const height = paintCanvas.height;
  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || x >= width || y < 0 || y >= height) return false;

  const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
  const paintImgData = paintCtx.getImageData(0, 0, width, height);
  const pData = paintImgData.data;

  const bgImgData = bgCanvas ? getBgImageData(bgCanvas, width, height) : null;
  const bgData = bgImgData ? bgImgData.data : null;

  const seedIndex = (y * width + x) * 4;
  const seedR = pData[seedIndex];
  const seedG = pData[seedIndex + 1];
  const seedB = pData[seedIndex + 2];
  const seedA = pData[seedIndex + 3];

  const fillRgba = hexToRgba(fillColor, opacityPercent / 100);

  // 既に同色・同不透明度の場合はスキップ
  if (
    seedA > 100 &&
    colorDistance(seedR, seedG, seedB, seedA, fillRgba.r, fillRgba.g, fillRgba.b, fillRgba.a) < 2
  ) {
    return false;
  }

  const strokeWallAlpha = PAINT_CONFIG.STROKE_WALL_ALPHA_THRESHOLD;
  const isBlankArea = seedA < strokeWallAlpha;
  const maxDistance = (tolerancePercent / 100) * 160;

  // 隙間閉じが有効な場合、手書き＋背景の途切れた線（開口部のみ）を接続したバリアマップを生成
  let barrierMap = null;
  if (gapClosing > 0 && isBlankArea) {
    barrierMap = createClosedBarrierMap(pData, bgData, width, height, gapClosing);
  }

  // ピクセル通過判定
  const isMatch = (px, py) => {
    const pos = py * width + px;
    if (barrierMap && barrierMap[pos] === 1) return false; // 隙間が塞がれた壁

    const idx = pos * 4;
    const a = pData[idx + 3];

    if (isBlankArea) {
      return a < strokeWallAlpha;
    } else {
      const r = pData[idx];
      const g = pData[idx + 1];
      const b = pData[idx + 2];
      return a >= 50 && colorDistance(r, g, b, a, seedR, seedG, seedB, seedA) <= maxDistance;
    }
  };

  // スキャンライン探索
  const mask = runScanlineFill(width, height, x, y, isMatch);

  // 線の境界への自然な食い込み（expandRadius）のみを適用（gapClosingには依存させず線周りを乱さない）
  const finalMask = expandRadius > 0 ? expandMask(mask, width, height, expandRadius) : mask;

  // 描画Canvasへ反映
  applyMaskToPaintCanvas(paintCanvas, finalMask, fillRgba);
  return true;
}

/**
 * AI・画像処理による任意オブジェクト・閉曲線の輪郭ペン線描画＋バケツ塗りつぶし連携 (Smart Object Fill ＋ 隙間閉じ)
 */
export function performSmartObjectFill(
  bgCanvas,
  paintCanvas,
  startX,
  startY,
  fillColor,
  tolerancePercent = 30,
  opacityPercent = 100,
  gapClosing = PAINT_CONFIG.DEFAULT_GAP_CLOSING
) {
  const width = paintCanvas.width;
  const height = paintCanvas.height;
  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || x >= width || y < 0 || y >= height) return false;

  const bgImgData = getBgImageData(bgCanvas, width, height);
  const data = bgImgData.data;

  const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
  const paintImgData = paintCtx.getImageData(0, 0, width, height);
  const pData = paintImgData.data;

  const seedIndex = (y * width + x) * 4;
  const seedR = data[seedIndex];
  const seedG = data[seedIndex + 1];
  const seedB = data[seedIndex + 2];
  const seedA = data[seedIndex + 3];

  const fillRgba = hexToRgba(fillColor, opacityPercent / 100);

  const strokeWallAlpha = PAINT_CONFIG.STROKE_WALL_ALPHA_THRESHOLD;
  const maxColorDist = (tolerancePercent / 100) * 160;
  const edgeBarrierThreshold = 28 + (100 - tolerancePercent) * 0.8;

  // 隙間閉じバリアマップ
  let barrierMap = null;
  if (gapClosing > 0) {
    barrierMap = createClosedBarrierMap(pData, data, width, height, gapClosing);
  }

  const regionMask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = [x, y];
  let head = 0;

  regionMask[y * width + x] = 1;
  visited[y * width + x] = 1;

  const getGray = (px, py) => {
    if (px < 0 || px >= width || py < 0 || py >= height) return 0;
    const idx = (py * width + px) * 4;
    return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  };

  const getSobelMagnitude = (px, py) => {
    if (px <= 0 || px >= width - 1 || py <= 0 || py >= height - 1) return 0;
    const gx =
      -getGray(px - 1, py - 1) + getGray(px + 1, py - 1) -
      2 * getGray(px - 1, py) + 2 * getGray(px + 1, py) -
      getGray(px - 1, py + 1) + getGray(px + 1, py + 1);

    const gy =
      -getGray(px - 1, py - 1) - 2 * getGray(px, py - 1) - getGray(px + 1, py - 1) +
      getGray(px - 1, py + 1) + 2 * getGray(px, py + 1) + getGray(px + 1, py + 1);

    return Math.hypot(gx, gy);
  };

  const dx = [1, -1, 0, 0, 1, -1, 1, -1];
  const dy = [0, 0, 1, -1, 1, 1, -1, -1];

  // 1. シード点から領域探索 (Region Growing)
  while (head < queue.length) {
    const curX = queue[head++];
    const curY = queue[head++];

    const curIdx = (curY * width + curX) * 4;
    const curR = data[curIdx];
    const curG = data[curIdx + 1];
    const curB = data[curIdx + 2];
    const curA = data[curIdx + 3];

    for (let i = 0; i < 8; i++) {
      const nx = curX + dx[i];
      const ny = curY + dy[i];

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const pos = ny * width + nx;
      if (visited[pos]) continue;

      // 隙間閉じバリアに衝突したら停止
      if (barrierMap && barrierMap[pos] === 1) {
        visited[pos] = 1;
        continue;
      }

      const nIdx = pos * 4;

      if (pData[nIdx + 3] >= strokeWallAlpha) {
        visited[pos] = 1;
        continue;
      }

      const nr = data[nIdx];
      const ng = data[nIdx + 1];
      const nb = data[nIdx + 2];
      const na = data[nIdx + 3];

      const distToSeed = colorDistance(nr, ng, nb, na, seedR, seedG, seedB, seedA);
      const distToCur = colorDistance(nr, ng, nb, na, curR, curG, curB, curA);
      const edgeMag = getSobelMagnitude(nx, ny);

      const isInsideTolerance = distToSeed <= maxColorDist;
      const isSmoothTransition = distToCur <= maxColorDist * 1.2;
      const isEdgeBarrier = distToSeed > maxColorDist * 0.45 && edgeMag >= edgeBarrierThreshold;

      if (isInsideTolerance && isSmoothTransition && !isEdgeBarrier) {
        visited[pos] = 1;
        regionMask[pos] = 1;
        queue.push(nx, ny);
      } else {
        visited[pos] = 1;
      }
    }
  }

  // 2. 輪郭境界ペン線マスクの生成
  const boundaryStrokeMask = new Uint8Array(width * height);
  const strokeRadius = PAINT_CONFIG.SMART_FILL_STROKE_RADIUS;
  const rCeil = Math.ceil(strokeRadius);
  const rSquared = strokeRadius * strokeRadius;

  for (let py = 0; py < height; py++) {
    const rowOffset = py * width;
    for (let px = 0; px < width; px++) {
      const pos = rowOffset + px;
      if (regionMask[pos] === 1) {
        const isBorder =
          px === 0 ||
          px === width - 1 ||
          py === 0 ||
          py === height - 1 ||
          regionMask[pos - 1] === 0 ||
          regionMask[pos + 1] === 0 ||
          regionMask[pos - width] === 0 ||
          regionMask[pos + width] === 0;

        if (isBorder) {
          for (let sdy = -rCeil; sdy <= rCeil; sdy++) {
            const sny = py + sdy;
            if (sny < 0 || sny >= height) continue;
            const sdy2 = sdy * sdy;
            const sRowOffset = sny * width;

            for (let sdx = -rCeil; sdx <= rCeil; sdx++) {
              if (sdx * sdx + sdy2 <= rSquared) {
                const snx = px + sdx;
                if (snx >= 0 && snx < width) {
                  boundaryStrokeMask[sRowOffset + snx] = 1;
                }
              }
            }
          }
        }
      }
    }
  }

  // 3. 領域内部へのスキャンライン塗りつぶし
  const canFloodPass = (fx, fy) => {
    const fpos = fy * width + fx;
    return pData[fpos * 4 + 3] < strokeWallAlpha && regionMask[fpos] === 1;
  };

  let startFloodX = x;
  let startFloodY = y;

  if (!canFloodPass(x, y)) {
    let foundInner = false;
    for (let searchR = 1; searchR <= 15 && !foundInner; searchR++) {
      for (let sdy = -searchR; sdy <= searchR && !foundInner; sdy++) {
        const sny = y + sdy;
        if (sny < 0 || sny >= height) continue;
        for (let sdx = -searchR; sdx <= searchR && !foundInner; sdx++) {
          const snx = x + sdx;
          if (snx >= 0 && snx < width && canFloodPass(snx, sny)) {
            startFloodX = snx;
            startFloodY = sny;
            foundInner = true;
          }
        }
      }
    }
  }

  const innerFillMask = runScanlineFill(width, height, startFloodX, startFloodY, canFloodPass);

  // 4. マスク合成（ペン線への食い込み膨張 ＋ 境界ストローク ＋ 元領域）
  const expandedInnerMask = expandMask(
    innerFillMask,
    width,
    height,
    PAINT_CONFIG.FLOOD_FILL_EXPAND_RADIUS || 1.0
  );

  const finalMask = new Uint8Array(width * height);
  for (let i = 0; i < finalMask.length; i++) {
    if (regionMask[i] === 1 || boundaryStrokeMask[i] === 1 || expandedInnerMask[i] === 1) {
      finalMask[i] = 1;
    }
  }

  const fullyFilledMask = expandMask(
    finalMask,
    width,
    height,
    PAINT_CONFIG.SMART_FILL_EXPAND_RADIUS || 1.0
  );

  // 5. 描画Canvasに反映
  applyMaskToPaintCanvas(paintCanvas, fullyFilledMask, fillRgba);
  return true;
}

/**
 * 生成されたマスクを描画Canvas（paintCanvas）に反映します。
 */
function applyMaskToPaintCanvas(paintCanvas, mask, fillRgba) {
  const width = paintCanvas.width;
  const height = paintCanvas.height;
  const ctx = paintCanvas.getContext('2d', { willReadFrequently: true });

  const paintImgData = ctx.getImageData(0, 0, width, height);
  const pData = paintImgData.data;

  const { r: fr, g: fg, b: fb, a: fa } = fillRgba;
  const alphaNorm = fa / 255;

  if (alphaNorm >= 0.99) {
    // 完全不透明: 32bit uint一括書き込み（高速化）
    const buf = paintImgData.data.buffer;
    const u32 = new Uint32Array(buf);
    const pixel32 = ((255 << 24) | (fb << 16) | (fg << 8) | fr) >>> 0;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        u32[i] = pixel32;
      }
    }
  } else {
    // 半透明ブレンド (Alpha Compositing)
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const idx = i * 4;
        const prevA = pData[idx + 3] / 255;
        const outA = alphaNorm + prevA * (1 - alphaNorm);
        if (outA > 0) {
          pData[idx] = Math.round((fr * alphaNorm + pData[idx] * prevA * (1 - alphaNorm)) / outA);
          pData[idx + 1] = Math.round((fg * alphaNorm + pData[idx + 1] * prevA * (1 - alphaNorm)) / outA);
          pData[idx + 2] = Math.round((fb * alphaNorm + pData[idx + 2] * prevA * (1 - alphaNorm)) / outA);
          pData[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  }

  ctx.putImageData(paintImgData, 0, 0);
}
