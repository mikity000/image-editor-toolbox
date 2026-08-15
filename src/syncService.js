import { FabricImage, Point } from 'fabric';
import io from 'socket.io-client';

// ─────────────────────────────────────
// Fabric キャンバス上の画像状態をシリアライズ
export function serializeImages(canvas, options = { includeBackground: true, includeImages: true }) {
  if (!canvas) return [];
  const { includeBackground = true, includeImages = true } = options;
  const states = [];

  // 背景画像
  if (includeBackground) {
    const bg = canvas.backgroundImage;
    if (bg) {
      const origW = bg._element?.naturalWidth || bg.width || 0;
      const origH = bg._element?.naturalHeight || bg.height || 0;

      states.push({
        type: 'background',
        src: bg.origSrc || bg._element?.src || '',
        origImgW: origW,
        origImgH: origH,
        angle: bg.angle || 0,
      });
    }
  }

  // 通常画像
  if (includeImages) {
    const objects = typeof canvas.getObjects === 'function' ? canvas.getObjects() : [];
    objects
      .filter(o => o instanceof FabricImage)
      .forEach(o => {
        const matrix = o.calcTransformMatrix ? o.calcTransformMatrix() : [1, 0, 0, 1, 0, 0];
        const p1 = new Point(0, 0), p2 = new Point(o.width ?? 0, o.height ?? 0);
        const t1 = p1.transform(matrix), t2 = p2.transform(matrix);
        const width = Math.abs(t2.x - t1.x);
        const height = Math.abs(t2.y - t1.y);
        const rect = o.getBoundingRect ? o.getBoundingRect(true) : { left: o.left, top: o.top };

        states.push({
          type: 'image',
          src: o.origSrc || o._element?.src || '',
          left: rect.left,
          top: rect.top,
          scaleX: width / (o.width || 1),
          scaleY: height / (o.height || 1),
          angle: o.angle || 0,
          fileName: o.fileName || '',
        });
      });
  }

  return states;
}

// ─────────────────────────────────────
// シリアライズ済み状態から FabricImage を復元
export function restoreImages(canvas, imageStates = [], options = { includeBackground: true, includeImages: true }) {
  if (!canvas) return Promise.resolve();
  canvas.clear();
  const { includeBackground = true, includeImages = true } = options;

  const states = [...imageStates];
  const promises = [];

  // 背景画像を復元
  if (includeBackground) {
    const idx = states.findIndex(s => s.type === 'background');
    if (idx !== -1) {
      const s = states.splice(idx, 1)[0];
      if (s.src) {
        promises.push(new Promise(resolve => {
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.src = s.src;
          imgEl.onload = () => {
            const cW = canvas.getWidth();
            const cH = canvas.getHeight();
            const origW = s.origImgW || imgEl.naturalWidth || cW;
            const origH = s.origImgH || imgEl.naturalHeight || cH;

            const scale = Math.min(cW / (origW || 1), cH / (origH || 1));
            const wPx = origW * scale;
            const hPx = origH * scale;
            const left = (cW - wPx) / 2;
            const top = (cH - hPx) / 2;

            const bgImg = new FabricImage(imgEl, {
              left,
              top,
              scaleX: scale,
              scaleY: scale,
              angle: s.angle || 0,
              selectable: false,
              evented: false,
            });
            bgImg.origSrc = s.src;
            canvas.backgroundImage = bgImg;
            canvas.renderAll();
            resolve();
          };
          imgEl.onerror = () => {
            console.warn('背景画像の復元に失敗しました:', s.src);
            resolve();
          };
        }));
      }
    }
  }

  // 通常画像を復元
  if (includeImages) {
    states.forEach(state => {
      if (state.type !== 'image' || !state.src) return;
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
            angle: state.angle || 0,
            selectable: true,
            hasControls: true,
            lockUniScaling: false,
          });
          inst.origSrc = state.src;
          inst.fileName = state.fileName;
          canvas.add(inst);
          resolve();
        };
        imgEl.onerror = () => {
          console.warn('画像の復元に失敗しました:', state.fileName || state.src);
          resolve();
        };
      }));
    });
  }

  return Promise.all(promises).then(() => {
    canvas.renderAll();
  });
}

// ─────────────────────────────────────
// チャンクを受信してコンポーネントにデータを渡す
const receiveChunk = (incoming, onReceive, id, index, total, chunk) => {
  if (!incoming[id]) {
    incoming[id] = { total, parts: [] };
  }
  incoming[id].parts[index] = chunk;
  
  if (incoming[id].parts.filter(Boolean).length !== total) return;
  
  const full = incoming[id].parts.join('');
  delete incoming[id];

  try {
    const data = JSON.parse(full);
    onReceive(data);
  } catch (err) {
    console.error('チャンクデータのパースに失敗しました:', err);
  }
};

// ─────────────────────────────────────
// 大きいデータはチャンク化して送信
export function sendChunk(socket, payload, eventName) {
  if (!socket) return;
  const CHUNK = 900 * 1024;
  let json;
  try {
    json = JSON.stringify(payload);
  } catch (err) {
    console.error('ペイロードのシリアライズに失敗しました:', err);
    return;
  }

  const total = Math.ceil(json.length / CHUNK);
  const session = `${socket.id || 'session'}_${Date.now()}`;
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
  const { url, onReceive = () => {}, autoSync = true } = options;
  const socket = io(url, { transports: ['websocket'], reconnectionAttempts: 3, timeout: 5000 });
  const incoming = {};

  const handleChunk = ({ id, index, total, chunk }) => {
    receiveChunk(incoming, onReceive, id, index, total, chunk);
  };

  socket.on('canvas:sync-chunk', handleChunk);

  const emit = (opts = { includeBackground: true, includeImages: true }) => {
    const payload = serializeImages(canvas, opts);
    sendChunk(socket, payload, 'canvas:sync-chunk');
  };

  const handleModified = () => emit();
  if (autoSync && canvas) {
    canvas.on('object:modified', handleModified);
  }

  const cleanup = () => {
    socket.off('canvas:sync-chunk', handleChunk);
    if (autoSync && canvas) {
      canvas.off('object:modified', handleModified);
    }
    socket.disconnect();
  };

  return { socket, emitSync: emit, cleanup };
}

// ─────────────────────────────────────
// 画像一覧同期専用セットアップ
export function setupListSync(options = {}) {
  const { url, onReceive = () => {} } = options;
  const socket = io(url, { transports: ['websocket'], reconnectionAttempts: 3, timeout: 5000 });
  const incoming = {};

  const handleChunk = ({ id, index, total, chunk }) => {
    receiveChunk(incoming, onReceive, id, index, total, chunk);
  };

  socket.on('list:sync-chunk', handleChunk);

  const emitListSync = (listData) => sendChunk(socket, listData, 'list:sync-chunk');

  const cleanup = () => {
    socket.off('list:sync-chunk', handleChunk);
    socket.disconnect();
  };

  return { socket, emitListSync, cleanup };
}