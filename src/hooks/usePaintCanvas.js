import { useState, useRef, useCallback, useEffect } from 'react';
import { PAINT_CONFIG, APP_CONFIG, PDF_CONFIG, IMAGE_CONFIG } from '../constants/Constants';
import { loadPdfDocument, renderPdfPage } from '../utils/pdfRenderUtils';
import { fileToDataUrl } from '../utils/imageUtils';
import { convertToWebP } from '../utils/webpConverter';
import { performFloodFill, performSmartObjectFill } from '../utils/floodFillUtils';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

// Shiftキー直線描画用 45度刻み（水平・垂直・45度斜め）の単位ベクトル計算
function getSnappedVector(dx, dy) {
  if (dx === 0 && dy === 0) return { cos: 1, sin: 0 };
  const angle = Math.atan2(dy, dx);
  const snapStep = Math.PI / 4; // 45度刻み
  const snappedAngle = Math.round(angle / snapStep) * snapStep;

  let cos = Math.cos(snappedAngle);
  let sin = Math.sin(snappedAngle);

  // 水平・垂直の微小誤差を0に丸める
  if (Math.abs(sin) < 0.001) {
    sin = 0;
    cos = Math.sign(cos) || 1;
  } else if (Math.abs(cos) < 0.001) {
    cos = 0;
    sin = Math.sign(sin) || 1;
  }
  return { cos, sin };
}

// 点と線分の最短距離計算 (ストローク消去ヒットテスト用)
function distanceToSegment(p, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);

  let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * ストロークを Canvas コンテキストに描画する共通レンダラー
 * @param {CanvasRenderingContext2D} ctx 描画先コンテキスト
 * @param {object} stroke ストロークオブジェクト
 * @param {HTMLCanvasElement} [tempCanvas] 蛍光ペン用の一時オフスクリーンキャンバス
 */
function renderStrokeToContext(ctx, stroke, tempCanvas = null) {
  const { tool, color, brushSize, points, isStraight } = stroke;

  if (tool === 'raster') {
    if (stroke.imageObj && stroke.imageObj.complete && stroke.imageObj.naturalWidth > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.drawImage(stroke.imageObj, 0, 0);
      ctx.restore();
    }
    return;
  }

  if (!points || points.length === 0) return;

  if (tool === 'highlighter') {
    // 蛍光ペン: オフスクリーンキャンバスで不透明描画後、半透明で合成
    const sCanvas = tempCanvas || document.createElement('canvas');
    if (sCanvas.width !== ctx.canvas.width || sCanvas.height !== ctx.canvas.height) {
      sCanvas.width = ctx.canvas.width;
      sCanvas.height = ctx.canvas.height;
    }
    const sCtx = sCanvas.getContext('2d');
    sCtx.clearRect(0, 0, sCanvas.width, sCanvas.height);
    sCtx.lineCap = 'round';
    sCtx.lineJoin = 'round';
    sCtx.strokeStyle = color;
    sCtx.fillStyle = color;
    sCtx.lineWidth = brushSize;
    sCtx.globalAlpha = 1.0;

    if (points.length === 1) {
      sCtx.beginPath();
      sCtx.arc(points[0].x, points[0].y, sCtx.lineWidth / 2, 0, Math.PI * 2);
      sCtx.fill();
    } else {
      sCtx.beginPath();
      sCtx.moveTo(points[0].x, points[0].y);
      if (isStraight) {
        sCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      } else {
        for (let i = 1; i < points.length; i++) {
          sCtx.lineTo(points[i].x, points[i].y);
        }
      }
      sCtx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = PAINT_CONFIG.HIGHLIGHTER_OPACITY;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sCanvas, 0, 0);
    ctx.restore();
  } else {
    // 通常ペン または ピクセル消しゴム
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = brushSize;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = brushSize;
    }

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      if (isStraight) {
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      } else {
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function usePaintCanvas() {
  // Canvas 参照
  const containerRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const paintCanvasRef = useRef(null);

  // メディア状態
  const [mediaType, setMediaType] = useState(null); // 'image' | 'pdf' | null
  const [fileName, setFileName] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const [renderTrigger, setRenderTrigger] = useState(0);

  // PDF ドキュメント参照
  const pdfDocRef = useRef(null);
  const pdfBytesRef = useRef(null);

  // ページごとの背景データ (キャッシュ)
  const baseImagesRef = useRef({});

  // ページごとの描画履歴スタック
  const pageHistoriesRef = useRef({});

  // ページごとのストロークデータ管理
  const pageStrokesRef = useRef({});

  // 描画ツール設定
  const [activeTool, setActiveTool] = useState('pen'); // 'pen' | 'highlighter' | 'eraser' | 'bucket' | 'smart_fill'
  const [eraserMode, setEraserMode] = useState('pixel'); // 'pixel' | 'stroke'
  const [color, setColor] = useState(PAINT_CONFIG.DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(PAINT_CONFIG.DEFAULT_BRUSH_SIZE);
  const [tolerance, setTolerance] = useState(PAINT_CONFIG.DEFAULT_TOLERANCE);
  const [fillOpacity, setFillOpacity] = useState(PAINT_CONFIG.DEFAULT_FILL_OPACITY);
  const [gapClosing, setGapClosing] = useState(PAINT_CONFIG.DEFAULT_GAP_CLOSING);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ズーム・パン状態
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isAltPressed, setIsAltPressed] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const isAltPressedRef = useRef(false);

  // 描画中フラグ・座標
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const startPointRef = useRef(null);
  const currentStrokePointsRef = useRef([]);
  const isShiftSnappedRef = useRef(false);
  const shiftLockAxisRef = useRef(null); // Shift直線用ロック軸 ('horizontal' | 'vertical' | null)
  const strokeModifiedRef = useRef(false);

  // 蛍光ペン等の重なり防止・Shiftプレビュー用オフスクリーンバッファ
  const strokeCanvasRef = useRef(null);
  const strokeSnapshotRef = useRef(null);

  // Altキー押下状態の監視 (パンモード用)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Alt' && !isAltPressedRef.current) {
        isAltPressedRef.current = true;
        setIsAltPressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Alt') {
        isAltPressedRef.current = false;
        setIsAltPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ズームイン・ズームアウト・リセット
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(Math.round((prev + 0.2) * 10) / 10, 5.0));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(Math.round((prev - 0.2) * 10) / 10, 0.2));
  }, []);

  const resetZoomPan = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // マウスホイールによるズーム
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.2), 5.0);
      return Math.round(nextZoom * 100) / 100;
    });
  }, []);

  // Undo/Redo ボタンの状態を更新
  const updateUndoRedoState = useCallback((pageNum) => {
    const history = pageHistoriesRef.current[pageNum];
    setCanUndo(Boolean(history && history.undoStack.length > 0));
    setCanRedo(Boolean(history && history.redoStack.length > 0));
  }, []);

  // 履歴スタックへのプッシュ操作を一元化
  const pushHistoryEntry = useCallback((pageNum, dataUrl, strokes) => {
    if (!pageHistoriesRef.current[pageNum]) {
      pageHistoriesRef.current[pageNum] = { undoStack: [], redoStack: [] };
    }
    const history = pageHistoriesRef.current[pageNum];
    history.undoStack.push({ dataUrl, strokes: [...strokes] });

    if (history.undoStack.length > APP_CONFIG.MAX_HISTORY_STACK) {
      history.undoStack.shift();
    }
    history.redoStack = [];
    updateUndoRedoState(pageNum);
  }, [updateUndoRedoState]);

  // 描画Canvasに画像を復元
  const restorePaintCanvas = useCallback((entry, width, height) => {
    const paintCanvas = paintCanvasRef.current;
    if (!paintCanvas) return;
    const ctx = paintCanvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const dataUrl = entry?.dataUrl || (typeof entry === 'string' ? entry : null);
    if (!dataUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();
    };
    img.src = dataUrl;
  }, []);

  // 指定ページの全ストロークをCanvasに再描画
  const renderAllStrokes = useCallback((pageNum) => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!strokeCanvasRef.current) {
      strokeCanvasRef.current = document.createElement('canvas');
    }

    const strokes = pageStrokesRef.current[pageNum] || [];
    for (const stroke of strokes) {
      if (stroke.tool === 'raster' && !stroke.imageObj) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = stroke.dataUrl;
        stroke.imageObj = img;
        img.onload = () => renderAllStrokes(pageNum);
      } else {
        renderStrokeToContext(ctx, stroke, strokeCanvasRef.current);
      }
    }
  }, []);

  // ストローク消しゴムのヒット判定と削除
  const checkStrokeErase = useCallback((point) => {
    const strokes = pageStrokesRef.current[currentPage] || [];
    if (strokes.length === 0) return false;

    let modified = false;
    const hitRadius = brushSize / 2 + 10;

    const remainingStrokes = strokes.filter((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return true;
      const strokeRadius = hitRadius + (stroke.brushSize || 5) / 2;

      if (stroke.points.length === 1) {
        if (Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= strokeRadius) {
          modified = true;
          return false;
        }
        return true;
      }

      for (let i = 0; i < stroke.points.length - 1; i++) {
        if (distanceToSegment(point, stroke.points[i], stroke.points[i + 1]) <= strokeRadius) {
          modified = true;
          return false;
        }
      }
      return true;
    });

    if (modified) {
      pageStrokesRef.current[currentPage] = remainingStrokes;
      strokeModifiedRef.current = true;
      renderAllStrokes(currentPage);
      return true;
    }
    return false;
  }, [currentPage, brushSize, renderAllStrokes]);

  // 指定ページの背景を描画し、保存された手書き描画を復元
  const renderPage = useCallback(async (pageNum) => {
    const bgCanvas = bgCanvasRef.current;
    const paintCanvas = paintCanvasRef.current;
    if (!bgCanvas || !paintCanvas) return;

    setIsLoading(true);
    setLoadingText(`${pageNum} ページ目を読み込み中...`);

    try {
      let baseData = baseImagesRef.current[pageNum];
      if (!baseData && pdfDocRef.current) {
        baseData = await renderPdfPage(pdfDocRef.current, pageNum, 2.0);
        baseImagesRef.current[pageNum] = baseData;
      }

      if (baseData) {
        const { dataUrl, width, height } = baseData;
        setCanvasDimensions({ width, height });

        bgCanvas.width = width;
        bgCanvas.height = height;
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.clearRect(0, 0, width, height);

        const baseImg = new Image();
        baseImg.crossOrigin = 'anonymous';
        baseImg.src = dataUrl;
        await new Promise((resolve) => {
          baseImg.onload = () => {
            bgCtx.drawImage(baseImg, 0, 0, width, height);
            resolve();
          };
        });

        paintCanvas.width = width;
        paintCanvas.height = height;

        const history = pageHistoriesRef.current[pageNum];
        const latestEntry = history?.undoStack?.length > 0
          ? history.undoStack[history.undoStack.length - 1]
          : null;

        if (latestEntry?.strokes) {
          pageStrokesRef.current[pageNum] = [...latestEntry.strokes];
        }

        restorePaintCanvas(latestEntry, width, height);
        updateUndoRedoState(pageNum);
      }
    } catch (err) {
      console.error('ページの描画に失敗しました:', err);
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  }, [restorePaintCanvas, updateUndoRedoState]);

  // mediaType、currentPage、または renderTrigger が変更されたとき、マウントされた Canvas に確実に描画
  useEffect(() => {
    if (mediaType) {
      renderPage(currentPage);
    }
  }, [mediaType, currentPage, renderTrigger, renderPage]);

  // 現在ページの描画状態を保存
  const saveCurrentPageState = useCallback(() => {
    const paintCanvas = paintCanvasRef.current;
    if (!paintCanvas) return;

    const ctx = paintCanvas.getContext('2d');
    const pixelData = ctx.getImageData(0, 0, paintCanvas.width, paintCanvas.height).data;
    let hasContent = false;
    for (let i = 3; i < pixelData.length; i += 4) {
      if (pixelData[i] > 0) {
        hasContent = true;
        break;
      }
    }

    if (!pageHistoriesRef.current[currentPage]) {
      pageHistoriesRef.current[currentPage] = { undoStack: [], redoStack: [] };
    }

    if (hasContent) {
      const dataUrl = paintCanvas.toDataURL('image/png');
      const history = pageHistoriesRef.current[currentPage];
      const lastDataUrl = history.undoStack[history.undoStack.length - 1]?.dataUrl;
      if (lastDataUrl !== dataUrl) {
        pushHistoryEntry(currentPage, dataUrl, pageStrokesRef.current[currentPage] || []);
      }
    }
  }, [currentPage, pushHistoryEntry]);

  // ページ切り替え
  const changePage = useCallback(async (newPageNum) => {
    if (newPageNum < 1 || newPageNum > totalPages || newPageNum === currentPage) return;
    saveCurrentPageState();
    setCurrentPage(newPageNum);
  }, [currentPage, totalPages, saveCurrentPageState]);

  // Canvas と履歴の共通初期化
  const setupCanvasData = useCallback((baseData, name, numPages, isPdf = false) => {
    const { width, height } = baseData;
    baseImagesRef.current = { 1: baseData };
    pageHistoriesRef.current = { 1: { undoStack: [], redoStack: [] } };
    pageStrokesRef.current = { 1: [] };

    setFileName(name);
    setMediaType(isPdf ? 'pdf' : 'image');
    setTotalPages(numPages);
    setCurrentPage(1);
    setCanvasDimensions({ width, height });
    resetZoomPan();
    updateUndoRedoState(1);
    setRenderTrigger((prev) => prev + 1);
  }, [resetZoomPan, updateUndoRedoState]);

  // ファイル読み込みハンドラ (画像 / PDF)
  const loadFile = useCallback(async (file) => {
    if (!file) return;

    setIsLoading(true);
    setLoadingText('ファイルを読み込み中...');

    baseImagesRef.current = {};
    pageHistoriesRef.current = {};
    pdfDocRef.current = null;
    pdfBytesRef.current = null;

    try {
      if (file.type === 'application/pdf') {
        pdfBytesRef.current = await file.arrayBuffer();
        const { pdfDoc, numPages } = await loadPdfDocument(file);
        pdfDocRef.current = pdfDoc;

        const firstPageData = await renderPdfPage(pdfDoc, 1, 2.0);
        setupCanvasData(firstPageData, file.name, numPages, true);
      } else if (file.type.startsWith('image/')) {
        const dataUrl = await fileToDataUrl(file);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = dataUrl;

        await new Promise((resolve, reject) => {
          img.onload = () => {
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            setupCanvasData({ dataUrl, width, height }, file.name, 1, false);
            resolve();
          };
          img.onerror = reject;
        });
      } else {
        alert('対応していないファイル形式です。画像（JPEG/PNG等）またはPDFを選択してください。');
      }
    } catch (err) {
      console.error('ファイルの読み込みに失敗しました:', err);
      alert('ファイルの読み込みに失敗しました。');
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  }, [setupCanvasData]);

  // ギャラリーからの画像読み込み
  const loadImageFromDataUrl = useCallback((dataUrl, name = 'gallery_image.jpg') => {
    setIsLoading(true);
    setLoadingText('画像を読み込み中...');

    baseImagesRef.current = {};
    pageHistoriesRef.current = {};
    pdfDocRef.current = null;
    pdfBytesRef.current = null;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      setupCanvasData({ dataUrl, width, height }, name, 1, false);
      setIsLoading(false);
      setLoadingText('');
    };

    img.onerror = (err) => {
      console.error('ギャラリー画像の読み込みエラー:', err);
      setIsLoading(false);
      setLoadingText('');
    };
  }, [setupCanvasData]);

  // ポインター座標の Canvas 内部座標への変換
  const getCanvasCoordinates = useCallback((e) => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  // 描画開始 (PointerDown)
  const handlePointerDown = useCallback((e) => {
    if (!mediaType) return;
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    // Altキー押下または中ボタンクリックはパン操作
    if (e.altKey || isAltPressedRef.current || e.button === 1) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (e.button !== 0) return;

    if (e.cancelable) {
      e.preventDefault();
    }

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {}

    const point = getCanvasCoordinates(e);

    // 塗りつぶしツール (バケツ / スマート塗りつぶし)
    if (activeTool === 'bucket' || activeTool === 'smart_fill') {
      isDrawingRef.current = false;
      const success = activeTool === 'bucket'
        ? performFloodFill(
            bgCanvasRef.current,
            canvas,
            point.x,
            point.y,
            color,
            tolerance,
            fillOpacity,
            PAINT_CONFIG.FLOOD_FILL_EXPAND_RADIUS,
            gapClosing
          )
        : performSmartObjectFill(
            bgCanvasRef.current,
            canvas,
            point.x,
            point.y,
            color,
            tolerance,
            fillOpacity,
            gapClosing
          );

      if (success) {
        const dataUrl = canvas.toDataURL('image/png');
        if (!pageStrokesRef.current[currentPage]) {
          pageStrokesRef.current[currentPage] = [];
        }

        const rasterImg = new Image();
        rasterImg.crossOrigin = 'anonymous';
        rasterImg.src = dataUrl;
        pageStrokesRef.current[currentPage].push({
          id: `raster_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          tool: 'raster',
          dataUrl,
          imageObj: rasterImg,
        });

        pushHistoryEntry(currentPage, dataUrl, pageStrokesRef.current[currentPage]);
      }
      return;
    }

    // ストローク消しゴムモード
    if (activeTool === 'eraser' && eraserMode === 'stroke') {
      isDrawingRef.current = true;
      strokeModifiedRef.current = false;
      checkStrokeErase(point);
      return;
    }

    // 通常ペン / 蛍光ペン / ピクセル消しゴム
    isDrawingRef.current = true;
    startPointRef.current = point;
    lastPointRef.current = point;
    currentStrokePointsRef.current = [point];
    isShiftSnappedRef.current = Boolean(e.shiftKey);
    shiftLockAxisRef.current = null;

    const ctx = canvas.getContext('2d');
    strokeSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (!strokeCanvasRef.current) {
      strokeCanvasRef.current = document.createElement('canvas');
    }

    renderStrokeToContext(
      ctx,
      {
        tool: activeTool,
        color,
        brushSize,
        points: [point],
        isStraight: false,
      },
      strokeCanvasRef.current
    );
  }, [
    mediaType,
    activeTool,
    eraserMode,
    brushSize,
    color,
    tolerance,
    fillOpacity,
    gapClosing,
    currentPage,
    pan,
    getCanvasCoordinates,
    checkStrokeErase,
    pushHistoryEntry,
  ]);

  // 描画中 (PointerMove)
  const handlePointerMove = useCallback((e) => {
    if (isPanningRef.current) {
      setPan({
        x: Math.round(e.clientX - panStartRef.current.x),
        y: Math.round(e.clientY - panStartRef.current.y),
      });
      return;
    }

    if (!isDrawingRef.current) return;
    if (activeTool === 'bucket' || activeTool === 'smart_fill') return;
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const point = getCanvasCoordinates(e);

    if (activeTool === 'eraser' && eraserMode === 'stroke') {
      checkStrokeErase(point);
      return;
    }

    const ctx = canvas.getContext('2d');

    let drawPoint = point;

    // Shiftキー押下時：水平・垂直・45度斜めの直線上に拘束してリアルタイムに確定
    if ((isShiftSnappedRef.current || e.shiftKey) && startPointRef.current) {
      const p0 = startPointRef.current;
      const dx = point.x - p0.x;
      const dy = point.y - p0.y;

      let justLocked = false;
      if (!shiftLockAxisRef.current && (Math.abs(dx) >= PAINT_CONFIG.SHIFT_LOCK_THRESHOLD || Math.abs(dy) >= PAINT_CONFIG.SHIFT_LOCK_THRESHOLD)) {
        shiftLockAxisRef.current = getSnappedVector(dx, dy);
        justLocked = true;
      }

      const dir = shiftLockAxisRef.current || getSnappedVector(dx, dy);
      const t = dx * dir.cos + dy * dir.sin;
      drawPoint = {
        x: p0.x + t * dir.cos,
        y: p0.y + t * dir.sin,
      };

      // 直線化が有効になった瞬間：SHIFT_LOCK_THRESHOLD未満の乱れを除去し、始点からの直線に置換
      if (justLocked) {
        if (strokeSnapshotRef.current) {
          ctx.putImageData(strokeSnapshotRef.current, 0, 0);
        }
        currentStrokePointsRef.current = [p0];
        lastPointRef.current = p0;
      }
    }

    // 通常描画・Shift直線描画ともにリアルタイムにストローク点へ追加
    currentStrokePointsRef.current.push(drawPoint);

    if (activeTool === 'highlighter') {
      if (strokeSnapshotRef.current) {
        ctx.putImageData(strokeSnapshotRef.current, 0, 0);
      }
      renderStrokeToContext(
        ctx,
        {
          tool: 'highlighter',
          color,
          brushSize,
          points: currentStrokePointsRef.current,
          isStraight: false,
        },
        strokeCanvasRef.current
      );
    } else {
      // 増分描画（直前点から現在拘束点への線分）でリアルタイムにキャンバスへ直接確定
      if (lastPointRef.current) {
        renderStrokeToContext(
          ctx,
          {
            tool: activeTool,
            color,
            brushSize,
            points: [lastPointRef.current, drawPoint],
            isStraight: false,
          },
          strokeCanvasRef.current
        );
      }
    }
    lastPointRef.current = drawPoint;
  }, [activeTool, eraserMode, brushSize, color, checkStrokeErase, getCanvasCoordinates]);

  // 描画終了 (PointerUp)
  const handlePointerUp = useCallback((e) => {
    if (e?.target && e?.pointerId !== undefined) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // ストローク消しゴムの場合
    if (activeTool === 'eraser' && eraserMode === 'stroke') {
      if (strokeModifiedRef.current) {
        const canvas = paintCanvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        pushHistoryEntry(currentPage, dataUrl, pageStrokesRef.current[currentPage] || []);
      }
      return;
    }

    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    let strokePoints = [...currentStrokePointsRef.current];
    const isStraight = Boolean(isShiftSnappedRef.current || shiftLockAxisRef.current);

    if (!pageStrokesRef.current[currentPage]) {
      pageStrokesRef.current[currentPage] = [];
    }

    pageStrokesRef.current[currentPage].push({
      id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      tool: activeTool,
      color,
      brushSize,
      points: strokePoints,
      isStraight,
    });

    strokeSnapshotRef.current = null;
    startPointRef.current = null;
    lastPointRef.current = null;
    currentStrokePointsRef.current = [];
    isShiftSnappedRef.current = false;
    shiftLockAxisRef.current = null;

    if (activeTool === 'highlighter' && strokeCanvasRef.current) {
      const sCtx = strokeCanvasRef.current.getContext('2d');
      sCtx.clearRect(0, 0, strokeCanvasRef.current.width, strokeCanvasRef.current.height);
    }

    const dataUrl = canvas.toDataURL('image/png');
    pushHistoryEntry(currentPage, dataUrl, pageStrokesRef.current[currentPage]);
  }, [currentPage, activeTool, eraserMode, color, brushSize, pushHistoryEntry]);

  // Undo (1つ戻る)
  const undo = useCallback(() => {
    const history = pageHistoriesRef.current[currentPage];
    const canvas = paintCanvasRef.current;
    if (!history || history.undoStack.length === 0 || !canvas) return;

    const currentEntry = history.undoStack.pop();
    history.redoStack.push(currentEntry);

    const previousEntry = history.undoStack.length > 0
      ? history.undoStack[history.undoStack.length - 1]
      : null;

    pageStrokesRef.current[currentPage] = previousEntry?.strokes ? [...previousEntry.strokes] : [];
    restorePaintCanvas(previousEntry, canvas.width, canvas.height);
    updateUndoRedoState(currentPage);
  }, [currentPage, restorePaintCanvas, updateUndoRedoState]);

  // Redo (やり直す)
  const redo = useCallback(() => {
    const history = pageHistoriesRef.current[currentPage];
    const canvas = paintCanvasRef.current;
    if (!history || history.redoStack.length === 0 || !canvas) return;

    const nextEntry = history.redoStack.pop();
    history.undoStack.push(nextEntry);

    pageStrokesRef.current[currentPage] = nextEntry?.strokes ? [...nextEntry.strokes] : [];
    restorePaintCanvas(nextEntry, canvas.width, canvas.height);
    updateUndoRedoState(currentPage);
  }, [currentPage, restorePaintCanvas, updateUndoRedoState]);

  // 現在ページの描画を全消去
  const clearCurrentCanvas = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pageStrokesRef.current[currentPage] = [];
    const emptyDataUrl = canvas.toDataURL('image/png');
    pushHistoryEntry(currentPage, emptyDataUrl, []);
  }, [currentPage, pushHistoryEntry]);

  // キーボードショートカット (Ctrl+Z, Ctrl+Y / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const isMac = /Mac/i.test(navigator.userAgentData?.platform || navigator.userAgent || '');
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y' && !isMac) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // 指定ページの背景＋描画を合成した Canvas を生成
  const getMergedCanvasForPage = useCallback(async (pageNum) => {
    let baseData = baseImagesRef.current[pageNum];
    if (!baseData && pdfDocRef.current) {
      baseData = await renderPdfPage(pdfDocRef.current, pageNum, 2.0);
      baseImagesRef.current[pageNum] = baseData;
    }

    if (!baseData) return null;

    const { dataUrl: baseDataUrl, width, height } = baseData;
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = width;
    mergedCanvas.height = height;
    const ctx = mergedCanvas.getContext('2d');

    // 背景を描画
    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    baseImg.src = baseDataUrl;
    await new Promise((resolve) => {
      baseImg.onload = () => {
        ctx.drawImage(baseImg, 0, 0, width, height);
        resolve();
      };
    });

    // 手書き描画レイヤーを合成
    let drawingDataUrl = null;
    if (pageNum === currentPage && paintCanvasRef.current) {
      drawingDataUrl = paintCanvasRef.current.toDataURL('image/png');
    } else {
      const history = pageHistoriesRef.current[pageNum];
      if (history && history.undoStack.length > 0) {
        drawingDataUrl = history.undoStack[history.undoStack.length - 1]?.dataUrl;
      }
    }

    if (drawingDataUrl) {
      const drawImg = new Image();
      drawImg.crossOrigin = 'anonymous';
      drawImg.src = drawingDataUrl;
      await new Promise((resolve) => {
        drawImg.onload = () => {
          ctx.drawImage(drawImg, 0, 0, width, height);
          resolve();
        };
      });
    }

    return mergedCanvas;
  }, [currentPage]);

  // 現在ページの合成画像 DataURL を取得 (WebP対応)
  const getCurrentMergedDataUrl = useCallback(async () => {
    const mergedCanvas = await getMergedCanvasForPage(currentPage);
    if (!mergedCanvas) return null;
    return await convertToWebP(mergedCanvas, {
      quality: IMAGE_CONFIG.DEFAULT_WEBP_QUALITY,
    });
  }, [currentPage, getMergedCanvasForPage]);

  // 画像ファイル (WebP) としてダウンロード保存
  const exportAsImage = useCallback(async () => {
    if (!mediaType) return;
    setIsLoading(true);
    setLoadingText('画像を最適化中...');

    try {
      const mergedCanvas = await getMergedCanvasForPage(currentPage);
      if (!mergedCanvas) return;

      const webpDataUrl = await convertToWebP(mergedCanvas, {
        quality: IMAGE_CONFIG.DEFAULT_WEBP_QUALITY,
      });

      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'paint_image';
      const outName = totalPages > 1 ? `${baseName}_page${currentPage}.webp` : `${baseName}_edited.webp`;

      const res = await fetch(webpDataUrl);
      const blob = await res.blob();
      saveAs(blob, outName);
    } catch (err) {
      console.error('画像保存エラー:', err);
      alert('画像の保存に失敗しました。');
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  }, [mediaType, fileName, totalPages, currentPage, getMergedCanvasForPage]);

  // PDF ファイルとしてダウンロード保存
  const exportAsPdf = useCallback(async () => {
    if (!mediaType) return;
    setIsLoading(true);
    setLoadingText('PDF を保存中...');

    try {
      saveCurrentPageState();
      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'document';

      if (mediaType === 'pdf' && pdfBytesRef.current) {
        const pdfDoc = await PDFDocument.load(pdfBytesRef.current);
        const pages = pdfDoc.getPages();

        for (let p = 1; p <= totalPages; p++) {
          const history = pageHistoriesRef.current[p];
          const latestEntry = history?.undoStack?.length > 0
            ? history.undoStack[history.undoStack.length - 1]
            : null;

          const drawingDataUrl = latestEntry?.dataUrl || (typeof latestEntry === 'string' ? latestEntry : null);

          if (drawingDataUrl) {
            setLoadingText(`手書き描画を合成中... (${p} / ${totalPages} ページ)`);
            const res = await fetch(drawingDataUrl);
            const pngBytes = await res.arrayBuffer();
            const pngImage = await pdfDoc.embedPng(pngBytes);

            const page = pages[p - 1];
            if (page) {
              const { width, height } = page.getSize();
              page.drawImage(pngImage, {
                x: 0,
                y: 0,
                width,
                height,
              });
            }
          }
        }

        const pdfBytes = await pdfDoc.save();
        saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), `${baseName}_edited.pdf`);
      } else {
        const pdfDoc = await PDFDocument.create();
        const { PAGE_WIDTH_A4 } = PDF_CONFIG;

        const mergedCanvas = await getMergedCanvasForPage(1);
        if (mergedCanvas) {
          const dataUrl = mergedCanvas.toDataURL('image/jpeg', 0.85);
          const res = await fetch(dataUrl);
          const imageBytes = await res.arrayBuffer();
          const image = await pdfDoc.embedJpg(imageBytes);

          const scaleFactor = PAGE_WIDTH_A4 / image.width;
          const scaledHeight = image.height * scaleFactor;

          const page = pdfDoc.addPage([PAGE_WIDTH_A4, scaledHeight]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: PAGE_WIDTH_A4,
            height: scaledHeight,
          });
        }

        const pdfBytes = await pdfDoc.save();
        saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), `${baseName}_edited.pdf`);
      }
    } catch (err) {
      console.error('PDF出力エラー:', err);
      alert('PDFの保存に失敗しました。');
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  }, [mediaType, fileName, totalPages, saveCurrentPageState, getMergedCanvasForPage]);

  return {
    containerRef,
    bgCanvasRef,
    paintCanvasRef,
    mediaType,
    fileName,
    totalPages,
    currentPage,
    isLoading,
    loadingText,
    canvasDimensions,
    activeTool,
    setActiveTool,
    eraserMode,
    setEraserMode,
    color,
    setColor,
    brushSize,
    setBrushSize,
    tolerance,
    setTolerance,
    fillOpacity,
    setFillOpacity,
    gapClosing,
    setGapClosing,
    canUndo,
    canRedo,
    zoom,
    setZoom,
    pan,
    setPan,
    isAltPressed,
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoomPan,
    loadFile,
    loadImageFromDataUrl,
    changePage,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    undo,
    redo,
    clearCurrentCanvas,
    getCurrentMergedDataUrl,
    exportAsImage,
    exportAsPdf,
  };
}
