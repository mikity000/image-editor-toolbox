import { Image as FabricImage, Point, util } from 'fabric';
import io from 'socket.io-client';

// ─────────────────────────────────────
// Fabric キャンバス上の画像状態をシリアライズ
export function serializeImages(canvas, options = { includeBackground: true, includeImages: true }) {
  if (!canvas) return [];
  const { includeBackground, includeImages } = options;
  const states = [];

  // 背景画像
  if (includeBackground) {
    const bg = canvas.backgroundImage;
    if (bg) {
      // 元画像のピクセルサイズを取得
      const origW = bg._element.naturalWidth;
      const origH = bg._element.naturalHeight;

      states.push({
        type: 'background',
        src: bg.origSrc,
        origImgW: origW,
        origImgH: origH,
        angle: bg.angle,
      });
    }
  }

  // 通常画像
  if (includeImages) {
    canvas.getObjects()
      .filter(o => o instanceof FabricImage)
      .forEach(o => {
        const matrix = o.calcTransformMatrix();
        const p1 = new Point(0, 0), p2 = new Point(o.width ?? 0, o.height ?? 0);
        const t1 = util.transformPoint(p1, matrix), t2 = util.transformPoint(p2, matrix);
        const width = Math.abs(t2.x - t1.x);
        const height = Math.abs(t2.y - t1.y);
        const rect = o.getBoundingRect(true);
        states.push({
          type: 'image',
          src: o.origSrc,
          left: rect.left,
          top: rect.top,
          scaleX: width / (o.width ?? 1),
          scaleY: height / (o.height ?? 1),
          angle: o.angle,
          fileName: o.fileName,
        });
      });
  }

  return states;
}

// ─────────────────────────────────────
// シリアライズ済み状態から FabricImage を復元
export function restoreImages(canvas, imageStates, options = { includeBackground: true, includeImages: true }) {
  if (!canvas) return Promise.resolve();
  canvas.clear();
  const { includeBackground, includeImages } = options;

  const states = [...imageStates];
  const promises = [];

  // 背景画像を復元
  if (includeBackground) {
    const idx = states.findIndex(s => s.type === 'background');
    if (idx !== -1) {
      const s = states.splice(idx, 1)[0];
      promises.push(new Promise(resolve => {
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.src = s.src;
        imgEl.onload = () => {
          // 受信側キャンバスサイズ
          const cW = canvas.getWidth();
          const cH = canvas.getHeight();

          // 自分のキャンバスに収めるスケールを計算
          const scale = Math.min(cW / s.origImgW, cH / s.origImgH);

          // 中央配置のための left/top
          const wPx = s.origImgW * scale;
          const hPx = s.origImgH * scale;
          const left = (cW - wPx) / 2;
          const top = (cH - hPx) / 2;

          const bgImg = new FabricImage(imgEl, {
            left, top,
            scaleX: scale,
            scaleY: scale,
            angle: s.angle,
            selectable: false,
            evented: false,
          });
          bgImg.origSrc = s.src;
          canvas.backgroundImage = bgImg;
          canvas.renderAll();
          resolve();
        };
        imgEl.onerror = () => resolve();
      }));
    }
  }

  // 通常画像を復元
  if (includeImages) {
    states.forEach(state => {
      if (state.type !== 'image') return;
      promises.push(new Promise(resolve => {
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.src = state.src;
        imgEl.onload = () => {
          const inst = new FabricImage(imgEl, {
            left: state.left,
            top: state.top,
            scaleX: state.scaleX,
            scaleY: state.scaleY,
            angle: state.angle,
            selectable: true,
            hasControls: true,
            lockUniScaling: false,
          });
          inst.origSrc = state.src;
          inst.fileName = state.fileName;
          canvas.add(inst);
          resolve();
        };
        imgEl.onerror = () => resolve();
      }));
    });
  }

  return Promise.all(promises).then(() => canvas.renderAll());
}

// ─────────────────────────────────────
// チャンクを受信してコンポーネントにデータを渡す
const receiveChunk = (incoming, onReceive, id, index, total, chunk) => {
  if (!incoming[id])
    incoming[id] = { total, parts: [] };
  incoming[id].parts[index] = chunk;
  if (incoming[id].parts.filter(Boolean).length !== total)
    return;
  const full = incoming[id].parts.join('');
  delete incoming[id];
  const data = JSON.parse(full);
  onReceive(data);
};

// ─────────────────────────────────────
// 大きいデータはチャンク化して送信
export function sendChunk(socket, payload, eventName) {
  const CHUNK = 900 * 1024;
  const json = JSON.stringify(payload);
  const total = Math.ceil(json.length / CHUNK);
  const session = socket.id + '_' + Date.now();
  for (let i = 0; i < total; i++) {
    socket.emit(eventName, {
      id: session,
      index: i,
      total,
      chunk: json.slice(i * CHUNK, (i + 1) * CHUNK),
    });
  }
}

// ─────────────────────────────────────
// Socket.IO を使って同期ロジックを初期化
export function setupSync(canvas, options = {}) {
  const { url, onReceive = () => { }, autoSync = true } = options;
  const socket = io(url, { transports: ['websocket'], reconnectionAttempts: 3, timeout: 5000 });
  const incoming = {};

  socket.on('canvas:sync-chunk', ({ id, index, total, chunk }) => {
    receiveChunk(incoming, onReceive, id, index, total, chunk);
  });

  const emit = (opts = { includeBackground: true, includeImages: true }) => {
    const payload = serializeImages(canvas, opts);
    sendChunk(socket, payload, 'canvas:sync-chunk');
  };

  // トリミング枠を消したくないため追加
  if (autoSync)
    canvas.on('object:modified', () => emit());

  return { socket, emitSync: emit };
}

// ─────────────────────────────────────
// 画像一覧同期専用セットアップを追加
export function setupListSync(options = {}) {
  const { url, onReceive = () => { } } = options;
  const socket = io(url, { transports: ['websocket'], reconnectionAttempts: 3, timeout: 5000 });
  const incoming = {};

  socket.on('list:sync-chunk', ({ id, index, total, chunk }) => {
    receiveChunk(incoming, onReceive, id, index, total, chunk);
  });

  const emitListSync = (listData) => sendChunk(socket, listData, 'list:sync-chunk');

  return { socket, emitListSync };
}