import { useEffect, useRef, useState } from 'react';
import { Canvas, Image as FabricImage, ActiveSelection, Line, Point } from 'fabric';
import { setupSync, serializeImages, restoreImages } from '../syncService';

export default function CombinerComponent() {
  // 画像一覧用の state
  const [imageList, setImageList] = useState([]);

  // Fabric.js のキャンバス DOM 要素を参照するための ref
  const canvasRef = useRef(null);
  // Fabric.js の Canvas インスタンスを保持する state
  const [fabricCanvas, setFabricCanvas] = useState(null);
  // 同期用の Socket.IO インスタンス
  const socketRef = useRef(null);
  const emitSyncRef = useRef(null);

  // Undo/Redo 用のスタックを useRef で管理（レンダーに影響させない）
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  // 画像復元中に誤って再度スタックに追加されないようにフラグを立てる
  const isRestoring = useRef(false);

  // Alt + ドラッグによるパン操作中かどうかを記録するフラグ
  const isPanning = useRef(false);
  // パン動作時の最後のマウス位置を記録
  const lastPos = useRef({ x: 0, y: 0 });

  // タッチ操作用に、ピンチや二本指パンの状態を管理するオブジェクト
  const touchData = useRef({
    isTwoFing: false,     // 現在ピンチ中かどうか
    lastDist: 0,           // 前回の２点間距離
    isTouchPanning: false, // 二本指パン中かどうか（今回は不要だが拡張用に用意）
    lastTouchPos: { x: 0, y: 0 }, // 最後に記録した二本指の中点
  });

  // 選択中オブジェクト（または ActiveSelection）の幅・高さを表示するための state
  const [selectedSize, setSelectedSize] = useState(null);
  // ズームをリアルタイムで反映するためのstate
  const [zoomLevel, setZoomLevel] = useState(1);

  // ガイドラインの太さを管理する state
  const [guideThickness, setGuideThickness] = useState(1);

  // モバイル判定を navigator.userAgent とメディアクエリで判定
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;

  // ────────────────────────────────────────────────────────────
  // 現在の画像配置状態を Undo スタックに保存し、Redo スタックをクリア
  // ────────────────────────────────────────────────────────────
  const saveState = () => {
    //isRestoring フラグが true のときは復元処理中なので保存をスキップ
    if (isRestoring.current || !fabricCanvas) return;

    const imgStates = serializeImages(fabricCanvas);
    undoStack.current.push(imgStates); // Undo スタックに追加
    redoStack.current = [];            // Redo スタックをクリア
  };

  // ─────────────────────────────────────
  // Canvas 初期化＋ズーム／パン実装＋同期
  // useEffect はマウント時のみ一度実行
  // ─────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    // window.innerWidth、window.innerHeightを設定していたが画像クリック時、
    // 画像がCanvasの真ん中からずれていたので.canvas-wrapper要素の幅取得
    const wrapperEl = canvasRef.current.parentElement;
    // Fabric.js の Canvas を作成（背景透過、オブジェクト選択有効）
    const canvas = new Canvas(canvasRef.current, {
      width: wrapperEl.clientWidth,
      height: wrapperEl.clientHeight,
      backgroundColor: 'transparent',
      selection: true,
    });
    setFabricCanvas(canvas);

    // 汎用同期サービスをセットアップ
    // const { socket, emitSync } = setupSync(canvas, {
    //   url: 'http://192.000.0.0:3000',
    //   onReceive: states => restoreImages(canvas, states).then(() => setImageList(canvas.getObjects())),
    // });
    // socketRef.current = socket;
    // emitSyncRef.current = emitSync;

    // 初期状態として空配列を Undo スタックに登録
    undoStack.current = [[]];
    redoStack.current = [];

    // ────────── デスクトップ（マウス）用の処理 ──────────
    if (!isMobile) {
      // マウスホイールでズーム（ホイールの上下で拡大縮小）
      canvas.on('mouse:wheel', opt => {
        const evt = opt.e;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** evt.deltaY;          // デルタに応じて倍率を変化
        zoom = Math.min(Math.max(zoom, 0.1), 10); // 最小0.1～最大10倍に制限
        const pointer = canvas.getPointer(evt);   // マウスポインタ位置を取得
        canvas.zoomToPoint({ x: pointer.x, y: pointer.y }, zoom); // その座標を中心にズーム
        setZoomLevel(zoom);
        evt.preventDefault();                   // デフォルトのスクロール抑制
        evt.stopPropagation();
      });

      // Alt + ドラッグでキャンバス全体をパン（移動）する処理
      canvas.on('mouse:down', opt => {
        const evt = opt.e;
        if (evt.altKey) {
          isPanning.current = true;             // パン開始フラグを立てる
          lastPos.current = { x: evt.clientX, y: evt.clientY }; // 最初のマウス位置を保持
          canvas.defaultCursor = 'grab';          // カーソルを grab に変更
        }
      });
      canvas.on('mouse:move', opt => {
        if (isPanning.current) {
          const evt = opt.e;
          // 前回の位置との差分でキャンバスを移動
          const deltaX = evt.clientX - lastPos.current.x;
          const deltaY = evt.clientY - lastPos.current.y;
          canvas.relativePan({ x: deltaX, y: deltaY });
          lastPos.current = { x: evt.clientX, y: evt.clientY }; // 位置を更新
        }
      });
      canvas.on('mouse:up', () => {
        if (isPanning.current) {
          isPanning.current = false;            // パン終了フラグをリセット
          canvas.defaultCursor = 'default';       // カーソルを元に戻す
        }
      });
    }
    // ────────── モバイル（タッチ）用の処理 ──────────
    else {
      // ─────────────────────────────────────────────────
      // 2点間の距離を計算するヘルパー（ピンチの拡大縮小判定用）
      // ─────────────────────────────────────────────────
      const getTouchDist = e => {
        const [t0, t1] = e.touches;
        return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      };
      // ───────────────────────────────────────────────
      // 2点間の中点を計算するヘルパー（ピンチの中心点取得用）
      // ───────────────────────────────────────────────
      const getMidPoint = e => {
        const [t0, t1] = e.touches;
        return {
          x: (t0.clientX + t1.clientX) / 2,
          y: (t0.clientY + t1.clientY) / 2,
        };
      };

      // ─────────────────────────────────────
      // 2本指ズーム or 2本指パンを開始
      // ─────────────────────────────────────
      const touchStart = e => {
        if (e.touches.length === 2) {
          e.preventDefault();                     // ブラウザ既定の拡大縮小を抑制
          canvas.discardActiveObject(); // 選択状態をクリア
          touchData.current.isTwoFing = true;    // 2本指フラグ
          touchData.current.lastDist = getTouchDist(e); // 最初の2点距離を保持
          const mid = getMidPoint(e);
          touchData.current.lastMid = { x: mid.x, y: mid.y }; // 最初の中点を保持
        }
        // 1本指タッチはそのまま Fabric.js の矩形選択に任せる
      };

      // ─────────────────────────────────────────────
      // 2本指ピンチか2本指パンかを判定し、ズーム or パンを実行
      // ─────────────────────────────────────────────
      const touchMove = e => {
        if (touchData.current.isTwoFing && e.touches.length === 2) {
          e.preventDefault();
          const newDist = getTouchDist(e);
          const distDiff = Math.abs(newDist - touchData.current.lastDist);

          // 距離差が大きければピンチズーム
          if (distDiff > 30) {
            const scale = newDist / touchData.current.lastDist;
            const dampenedScale = 1 + (scale - 1) * 0.1; // ズーム倍率が強すぎたので0.1倍に調整
            let newZoom = canvas.getZoom() * scale * dampenedScale;
            newZoom = Math.min(Math.max(newZoom, 0.01), 10); // 最小0.01～最大10倍に制限

            const mid = getMidPoint(e);
            const pointer = canvas.getPointer({ clientX: mid.x, clientY: mid.y });
            canvas.zoomToPoint(new Point(pointer.x, pointer.y), newZoom);
            setZoomLevel(newZoom);

            touchData.current.lastDist = newDist;
            const updatedMid = getMidPoint(e);
            touchData.current.lastMid = { x: updatedMid.x, y: updatedMid.y };
          }
          // 距離差が小さければ2本指パン
          else {
            const mid = getMidPoint(e);
            const lastMid = touchData.current.lastMid;
            const deltaX = mid.x - lastMid.x;
            const deltaY = mid.y - lastMid.y;

            canvas.relativePan({ x: deltaX, y: deltaY });
            touchData.current.lastMid = { x: mid.x, y: mid.y };
          }
        }
        // 1本指ドラッグは Fabric.js の矩形選択（選択範囲の作成）に任せる
      };

      // ─────────────────────────────────────
      // 指が2本未満になったらピンチ状態を解除
      // ─────────────────────────────────────
      const touchEnd = e => {
        if (touchData.current.isTwoFing && e.touches.length < 2)
          touchData.current.isTwoFing = false;
        // 1本指→0本指の場合は特に何もしない
      };

      // Fabric.js が生成するキャンバス要素 (wrapperEl) にタッチイベントリスナーを登録
      const wrapper = canvas.wrapperEl;
      wrapper.style.touchAction = 'none'; // ブラウザ既定のピンチ／スクロールを抑制
      wrapper.addEventListener('touchstart', touchStart, { passive: false });
      wrapper.addEventListener('touchmove', touchMove, { passive: false });
      wrapper.addEventListener('touchend', touchEnd);

      // クリーンアップ時にイベントリスナーを削除
      const cleanup = () => {
        wrapper.removeEventListener('touchstart', touchStart);
        wrapper.removeEventListener('touchmove', touchMove);
        wrapper.removeEventListener('touchend', touchEnd);
      };
    }

    // ─────────────────────────────────────────────────────
    // 選択イベント (selection:created, selection:updated, selection:cleared)
    // のたびに、選択中オブジェクトの幅と高さを表示用 state にセットする関数
    // ─────────────────────────────────────────────────────
    const updateSelectedSize = () => {
      const active = canvas.getActiveObject();
      // 選択が無い場合は null をセット
      if (!active) {
        setSelectedSize(null);
        return;
      }

      // 複数オブジェクト選択 (ActiveSelection) の場合はバウンディングボックスを取得
      if (active instanceof ActiveSelection) {
        const rect = active.getBoundingRect();
        setSelectedSize({ width: rect.width, height: rect.height });
        return;
      } else {
        // 単一画像オブジェクトが選択されている場合
        setSelectedSize({ width: active.getScaledWidth(), height: active.getScaledHeight() });
        return;
      }
    };

    // 選択状態が変化したら updateSelectedSize を呼び出す
    canvas.on('selection:created', updateSelectedSize);
    canvas.on('selection:updated', updateSelectedSize);
    canvas.on('selection:cleared', () => setSelectedSize(null));

    // コンポーネントがアンマウントされるときに Canvas を破棄
    return () => {
      //socket.disconnect();
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, []);

  // 座標を整数に丸めるヘルパー（微小なブレを防ぐ）
  const snapToPixelPosition = obj => obj.set({ left: Math.round(obj.left), top: Math.round(obj.top) });
  // サイズを整数に丸めるヘルパー（微小なブレを防ぐ）
  const snapToPixelScale = obj => obj.set({ scaleX: Math.round(obj.getScaledWidth()) / obj.width, scaleY: Math.round(obj.getScaledHeight()) / obj.height });

  // ─────────────────────────────────────
  // オブジェクト移動／リサイズ時にスナップ＋ガイド更新＋サイズ表示更新
  // ─────────────────────────────────────
  useEffect(() => {
    if (!fabricCanvas) return;

    // ─────────────────────────────────────
    // オブジェクト移動中のハンドラ
    // ─────────────────────────────────────
    const onObjectMoving = e => {
      const obj = e.target;

      snapToPixelPosition(obj); // 座標をピクセル単位で丸める
      snapDuringMoving(obj) // 移動中に吸着させる
      updateGuides(obj);          // ガイドラインを更新

      // 移動中にサイズ表示も更新するため、ActiveObject を再取得
      const active = fabricCanvas.getActiveObject();
      // 複数選択移動中 (ActiveSelection) のときはバウンディングボックスを再計算
      if (active instanceof ActiveSelection && active === obj) {
        const rect = active.getBoundingRect();
        setSelectedSize({ width: rect.width, height: rect.height });
      } else {
        // 単一オブジェクト移動中
        setSelectedSize({ width: obj.getScaledWidth(), height: obj.getScaledHeight() });
      }
    };

    function snapDuringMoving(obj) {
      // 他のすべての画像オブジェクトを取得し、自分自身は除外
      const others = fabricCanvas
        .getObjects()
        .filter(o => o instanceof FabricImage && o !== obj);

      let left = obj.left;
      let top = obj.top;
      const width = obj.getScaledWidth();
      const height = obj.getScaledHeight();
      const candidateXs = [];
      const candidateYs = [];

      // 他オブジェクトの縁の座標リストを作成し、自分がスナップ可能な位置を収集
      others.forEach(o => {
        const oLeft = o.left;
        const oTop = o.top;
        const oRight = oLeft + o.getScaledWidth();
        const oBottom = oTop + o.getScaledHeight();
        candidateXs.push(oLeft, oRight, oLeft - width, oRight - width);
        candidateYs.push(oTop, oBottom, oTop - height, oBottom - height);
      });

      // スナップ許容範囲（ピクセル）。
      const SNAP_TOLERANCE = guideThickness * 5;
      // 自分の left/top にスナップ値を代入
      for (const sv of candidateXs)
        if (Math.abs(left - sv) <= SNAP_TOLERANCE)
          left = sv;
      for (const sv of candidateYs)
        if (Math.abs(top - sv) <= SNAP_TOLERANCE)
          top = sv;

      obj.set({ left, top }); // 座標を更新
    };

    // ────────────────────────────────────────────
    // オブジェクトリサイズ（スケーリング）中のハンドラ
    // ────────────────────────────────────────────
    const onObjectScaling = e => {
      const obj = e.target;

      snapDuringScaling(obj, e); // スケーリング中に吸着させる
      snapToPixelPosition(obj); // 座標をピクセル単位で丸める
      snapToPixelScale(obj); //スケールをピクセル単位で丸める
      updateGuides(obj); // リサイズ中にガイドを逐次更新

      // リサイズ中にサイズ表示も更新
      const active = fabricCanvas.getActiveObject();
      // 複数選択 (ActiveSelection) でグループを拡大縮小している場合
      if (active instanceof ActiveSelection && active === obj) {
        const rect = active.getBoundingRect();
        setSelectedSize({ width: rect.width, height: rect.height });
      } else {
        // 単一オブジェクトリサイズ中
        setSelectedSize({ width: obj.getScaledWidth(), height: obj.getScaledHeight() });
      }
    };

    function snapDuringScaling(obj, e) {
      const transform = e.transform;
      const corner = transform.corner;

      // 他のすべての画像オブジェクトを取得し、自分自身は除外
      const others = fabricCanvas
        .getObjects()
        .filter(o => o instanceof FabricImage && o !== obj);

      // スナップ許容範囲（ピクセル）
      const SNAP_TOLERANCE = guideThickness * 5;

      // 変形中のオブジェクトのバウンディングボックスを取得
      obj.setCoords();
      const objBoundingRect = obj.getBoundingRect();

      // オブジェクトの原点(obj.left/top)とバウンディングボックス左上隅とのオフセットを計算
      // これにより、座標系の違いを吸収し、正確な位置計算が可能になる
      const offsetX = obj.left - objBoundingRect.left;
      const offsetY = obj.top - objBoundingRect.top;

      // スナップ候補となる他のオブジェクトの辺の座標リストを作成
      const candidateXs = [];
      const candidateYs = [];
      others.forEach(o => {
        o.setCoords();
        const otherBoundingRect = o.getBoundingRect();
        candidateXs.push(otherBoundingRect.left, otherBoundingRect.left + otherBoundingRect.width);
        candidateYs.push(otherBoundingRect.top, otherBoundingRect.top + otherBoundingRect.height);
      });

      const newAttrs = {};
      let newScaleX = null;
      let newScaleY = null;

      // X軸のスナップ判定
      if (corner.includes('l')) { // 左側のハンドル(tl, ml, bl)を操作中
        for (const x of candidateXs) {
          if (Math.abs(objBoundingRect.left - x) <= SNAP_TOLERANCE) {
            const right = objBoundingRect.left + objBoundingRect.width;
            const newWidth = right - x;
            if (newWidth > 0) {
              newScaleX = newWidth / obj.width; // 新しいスケールを計算
              newAttrs.left = x + offsetX; // 新しいleft位置をオフセットを考慮して設定
            }
            break;
          }
        }
      } else if (corner.includes('r')) { // 右側のハンドル(tr, mr, br)を操作中
        for (const x of candidateXs) {
          if (Math.abs((objBoundingRect.left + objBoundingRect.width) - x) <= SNAP_TOLERANCE) {
            const newWidth = x - objBoundingRect.left;
            if (newWidth > 0) {
              newScaleX = newWidth / obj.width;
            }
            break;
          }
        }
      }

      // Y軸のスナップ判定
      if (corner.includes('t')) { // 上側のハンドル(tl, mt, tr)を操作中
        for (const y of candidateYs) {
          if (Math.abs(objBoundingRect.top - y) <= SNAP_TOLERANCE) {
            const bottom = objBoundingRect.top + objBoundingRect.height;
            const newHeight = bottom - y;
            if (newHeight > 0) {
              newScaleY = newHeight / obj.height;
              newAttrs.top = y + offsetY;
            }
            break;
          }
        }
      } else if (corner.includes('b')) { // 下側のハンドル(bl, mb, br)を操作中
        for (const y of candidateYs) {
          if (Math.abs((objBoundingRect.top + objBoundingRect.height) - y) <= SNAP_TOLERANCE) {
            const newHeight = y - objBoundingRect.top;
            if (newHeight > 0) {
              newScaleY = newHeight / obj.height;
            }
            break;
          }
        }
      }

      const snappedX = newScaleX !== null;
      const snappedY = newScaleY !== null;

      // --- アスペクト比の維持（コーナーハンドルの場合） ---
      if (corner.length === 2) {
        const scaleRatio = transform.original.scaleX / transform.original.scaleY;
        if (snappedX && !snappedY) {
          newScaleY = newScaleX / scaleRatio;
        } else if (snappedY && !snappedX) {
          newScaleX = newScaleY * scaleRatio;
        }
      }

      // 計算された新しいスケールがあれば適用
      if (newScaleX !== null) newAttrs.scaleX = newScaleX;
      if (newScaleY !== null) newAttrs.scaleY = newScaleY;

      // --- アスペクト比維持に伴う位置の補正 ---
      if (corner.length === 2) {
        // Y軸にスナップし、Xスケールが自動計算された場合 -> left位置を補正
        if (snappedY && !snappedX && corner.includes('l')) {
          const newWidth = obj.width * newScaleX;
          const right = objBoundingRect.left + objBoundingRect.width;
          newAttrs.left = right - newWidth + offsetX;
        }
        // X軸にスナップし、Yスケールが自動計算された場合 -> top位置を補正
        if (snappedX && !snappedY && corner.includes('t')) {
          const newHeight = obj.height * newScaleY;
          const bottom = objBoundingRect.top + objBoundingRect.height;
          newAttrs.top = bottom - newHeight + offsetY;
        }
      }

      // 計算された新しい属性があればオブジェクトに適用
      if (Object.keys(newAttrs).length > 0) {
        obj.set(newAttrs);
        obj.setCoords();
      }
    };

    // ─────────────────────────────────────
    // オブジェクト移動 or リサイズなど操作が完了した後のハンドラ
    // ─────────────────────────────────────
    const onObjectModified = () => {
      saveState();   // 操作終了後に状態を Undo スタックに保存
      updateGuides(); // ガイドラインを削除

      // 完了時にもサイズ表示を更新
      const active = fabricCanvas.getActiveObject();
      if (active instanceof ActiveSelection) {
        const rect = active.getBoundingRect();
        setSelectedSize({ width: rect.width, height: rect.height });
      } else {
        setSelectedSize({ width: active.getScaledWidth(), height: active.getScaledHeight() });
      }
    };

    // Fabric.js の各イベントに対して登録
    fabricCanvas.on('object:moving', onObjectMoving);
    fabricCanvas.on('object:scaling', onObjectScaling);
    fabricCanvas.on('object:modified', onObjectModified);

    // クリーンアップ：イベントリスナーをオフにする
    return () => {
      fabricCanvas.off('object:moving', onObjectMoving);
      fabricCanvas.off('object:scaling', onObjectScaling);
      fabricCanvas.off('object:modified', onObjectModified);
    };
  }, [fabricCanvas, guideThickness]);

  // ─────────────────────────────────────
  // 画像ファイルを追加したときのハンドラ
  //   - FileReader で読み込み、FabricImage を作成してキャンバスに追加
  //   - 追加後にガイド更新と状態保存 (Undo 用)
  // ─────────────────────────────────────
  const uploadImage = e => {
    if (!fabricCanvas) return;

    // ビューポート左上の実際の位置を取得（逆変換）
    const vpt = fabricCanvas.viewportTransform;
    const zoom = fabricCanvas.getZoom();
    const left = -vpt[4] / zoom;
    const top = -vpt[5] / zoom;

    const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    // 各画像の読み込みを Promise で管理
    const loadPromises = files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = event => {
          const dataURL = event.target.result; // base64 データを取得
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.src = dataURL;
          imgEl.onload = () => {
            // 画像読み込み完了後に FabricImage を作成
            const fabricImg = new FabricImage(imgEl, {
              left: left,
              top: top,
              scaleX: 1,
              scaleY: 1,
              angle: 0,
              selectable: true,
              hasControls: true,
              lockUniScaling: false,
            });
            fabricImg.origSrc = dataURL; // 後でシリアライズするために保持
            fabricImg.fileName = file.name; // ファイル名をプロパティとして保持
            fabricImg.setControlsVisibility({ mtr: false });
            fabricCanvas.add(fabricImg);  // キャンバスに追加
            resolve();
          };
          imgEl.onerror = () => resolve();
        }
        reader.readAsDataURL(file); // ファイルを dataURL に変換して読み込み
      });
    })

    // すべての画像が追加された後、一度だけ描画・同期
    Promise.all(loadPromises).then(() => {
      fabricCanvas.renderAll();     // 再描画
      saveState();                  // 追加後に状態を保存（Undo用）
      // 画像一覧に新しい画像を反映
      setImageList(fabricCanvas.getObjects());
      //emitSyncRef.current?.({ includeBackground: false, includeImages: true });
    });
  };

  // ─────────────────────────────────────
  // ガイドラインを更新する関数
  //   - キャンバス上のすべての画像オブジェクト間のスナップポイントを計算し、
  //     赤い Line オブジェクトを描画
  //   - ActiveSelection や回転後でも getBoundingRect() を使って正しい座標を取得
  // ─────────────────────────────────────
  const updateGuides = (obj = null) => {
    if (!fabricCanvas) return;
    // 既存のガイドライン をすべて削除
    fabricCanvas
      .getObjects()
      .filter(o => o.isGuide)
      .forEach(o => fabricCanvas.remove(o));

    // 対象オブジェクトがない場合は消すだけ
    if (!obj) {
      fabricCanvas.renderAll();
      return;
    }

    const rectA = obj.getBoundingRect();
    const aLeft = rectA.left;
    const aTop = rectA.top;
    const aRight = aLeft + rectA.width;
    const aBottom = aTop + rectA.height;
    const tolerance = 0.5; // スナップ検出の許容誤差

    const activeObjs = fabricCanvas.getActiveObjects();
    const others = fabricCanvas
      .getObjects()
      .filter(o => !activeObjs.includes(o));

    others.forEach(objB => {
      const rectB = objB.getBoundingRect();
      const bLeft = rectB.left;
      const bTop = rectB.top;
      const bRight = bLeft + rectB.width;
      const bBottom = bTop + rectB.height;

      // 横方向スナップ: objA の右辺と objB の左辺、またはその逆
      if (Math.abs(aRight - bLeft) <= tolerance) {
        const y1 = Math.min(aTop, bTop);
        const y2 = Math.max(aBottom, bBottom);
        addGuideLine([aRight, y1, aRight, y2]); // 垂直ガイドラインを描画
      } else if (Math.abs(bRight - aLeft) <= tolerance) {
        const y1 = Math.min(aTop, bTop);
        const y2 = Math.max(aBottom, bBottom);
        addGuideLine([bRight, y1, bRight, y2]);
      }

      // 縦方向スナップ: objA の下辺と objB の上辺、またはその逆
      if (Math.abs(aBottom - bTop) <= tolerance) {
        const x1 = Math.min(aLeft, bLeft);
        const x2 = Math.max(aRight, bRight);
        addGuideLine([x1, aBottom, x2, aBottom]); // 水平ガイドラインを描画
      } else if (Math.abs(bBottom - aTop) <= tolerance) {
        const x1 = Math.min(aLeft, bLeft);
        const x2 = Math.max(aRight, bRight);
        addGuideLine([x1, bBottom, x2, bBottom]);
      }

      // 上辺揃え
      if (Math.abs(aTop - bTop) <= tolerance) {
        const x1 = Math.min(aLeft, bLeft);
        const x2 = Math.max(aRight, bRight);
        const y = (aTop + bTop) / 2;
        addGuideLine([x1, y, x2, y]);
      }
      // 下辺揃え
      if (Math.abs(aBottom - bBottom) <= tolerance) {
        const x1 = Math.min(aLeft, bLeft);
        const x2 = Math.max(aRight, bRight);
        const y = (aBottom + bBottom) / 2;
        addGuideLine([x1, y, x2, y]);
      }
      // 左辺揃え
      if (Math.abs(aLeft - bLeft) <= tolerance) {
        const y1 = Math.min(aTop, bTop);
        const y2 = Math.max(aBottom, bBottom);
        const x = (aLeft + bLeft) / 2;
        addGuideLine([x, y1, x, y2]);
      }
      // 右辺揃え
      if (Math.abs(aRight - bRight) <= tolerance) {
        const y1 = Math.min(aTop, bTop);
        const y2 = Math.max(aBottom, bBottom);
        const x = (aRight + bRight) / 2;
        addGuideLine([x, y1, x, y2]);
      }
    });

    fabricCanvas.renderAll(); // 新しく追加されたガイドラインを画面に反映
  };

  // ──────────────────────────────────────────────────────────
  // ガイドライン（赤い線）を作成してキャンバスに追加するヘルパー関数
  // ──────────────────────────────────────────────────────────
  function addGuideLine(coords) {
    const guideLine = new Line(coords, {
      stroke: 'red',
      strokeWidth: guideThickness, // ユーザー設定の太さを使用
      selectable: false,              // ガイド自体は選択できない
      evented: false,                 // ガイドにイベントを飛ばさない
      hoverCursor: 'default',
    });
    guideLine.isGuide = true;         // 型判定用のフラグを追加
    fabricCanvas.add(guideLine);      // キャンバスに追加
  }

  // ─────────────────────────────────────
  // Undo 操作
  //   - Undo スタックに履歴があれば戻す
  //   - Redo スタックに一時保存
  // ─────────────────────────────────────
  const undo = async () => { // async を追加
    if (!fabricCanvas) return;
    if (undoStack.current.length <= 1) return; // 最低でも初期状態分の空配列があるので 1 以上
    const current = undoStack.current.pop();   // 現在の状態を取り除いて
    redoStack.current.push(current);           // Redo スタックに保存
    const previous = undoStack.current[undoStack.current.length - 1]; // 戻す状態を取得

    isRestoring.current = true;                // ここから復元フェーズ
    try {
      await restoreImages(fabricCanvas, previous);           // 画像を前の状態に復元（Promiseが解決するまで待つ）
    } catch (error) {
      console.error('[undo] undoでエラーが発生しました:', error);
    } finally {
      isRestoring.current = false;             // 復元処理終了フラグを下ろす
    }
    //emitSyncRef.current?.({ includeBackground: false, includeImages: true });
  };

  // ─────────────────────────────────────
  // Redo 操作
  //   - Redo スタックに履歴があれば再度反映
  // ─────────────────────────────────────
  const redo = async () => { // async を追加
    if (!fabricCanvas) return;
    if (redoStack.current.length === 0) return;
    const state = redoStack.current.pop();
    // Redo 先頭を取り出し
    undoStack.current.push(state);             // Undo スタックに戻す
    isRestoring.current = true;
    try {
      await restoreImages(fabricCanvas, state);              // 画像を次の状態に復元（Promiseが解決するまで待つ）
    } catch (error) {
      console.error('[redo] redoでエラーが発生しました:', error);
    } finally {
      isRestoring.current = false;             // 復元処理終了フラグを下ろす
    }
    //emitSyncRef.current?.({ includeBackground: false, includeImages: true });
  };

  // ─────────────────────────────────────
  // 選択中の画像オブジェクトを削除するハンドラ
  //   - 複数選択に対応し、FabricImage インスタンスのみ削除
  //   - 削除後にガイド更新と状態保存
  // ─────────────────────────────────────
  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjs = fabricCanvas.getActiveObjects(); // 現在選択中のオブジェクト配列
    if (!activeObjs.length) return;
    activeObjs.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.discardActiveObject(); // 選択状態をクリア
    fabricCanvas.requestRenderAll();
    saveState();    // 操作後に状態を保存
    // 画像一覧を更新
    setImageList(fabricCanvas.getObjects());
    //emitSyncRef.current?.({ includeBackground: false, includeImages: true });
  };

  // ─────────────────────────────────────
  // 余白トリミング＋ダウンロード処理
  //   - キャンバス全体ではなく、画像群の最小領域を計算してエクスポート
  // ─────────────────────────────────────
  const download = () => {
    if (!fabricCanvas) return;
    const imageObjects = fabricCanvas.getObjects();
    if (!imageObjects.length) return;

    // 複数選択(ActiveSelection)を解除
    fabricCanvas.discardActiveObject();
    // ビューポートをリセットしてからエクスポート
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // 画像オブジェクト群の最小 x,y (左上) と最大 x,y (右下) を計算
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    imageObjects.forEach(obj => {
      const l = obj.left, t = obj.top;
      const w = obj.getScaledWidth(), h = obj.getScaledHeight();
      minX = Math.min(minX, l);
      minY = Math.min(minY, t);
      maxX = Math.max(maxX, l + w);
      maxY = Math.max(maxY, t + h);
    });

    const exportWidth = maxX - minX;
    const exportHeight = maxY - minY;

    // 有効な領域があればデータURLを取得してリンクを作成しダウンロード
    if (exportWidth > 0 && exportHeight > 0) {
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        left: minX,
        top: minY,
        width: exportWidth,
        height: exportHeight,
        multiplier: 1,
      });
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = 'combined_trimmed.png';
      link.click();
    }
  };

  // ───────────────────────────────────────────────────────
  // 画像一覧クリック時に、その画像をキャンバス中心に表示する関数
  // ───────────────────────────────────────────────────────
  const clickImageList = imgObj => {
    if (!fabricCanvas) return;

    // オブジェクトのワールド座標上の中心を取得
    const centerPoint = imgObj.getCenterPoint();
    const worldCenterX = centerPoint.x;
    const worldCenterY = centerPoint.y;
    // 現在のズーム率とキャンバスサイズを取得
    const zoom = fabricCanvas.getZoom();
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();
    // world 座標 (worldCenterX * zoom + tx) = canvasWidth / 2 となるよう tx を求める
    const tx = canvasWidth / 2 - worldCenterX * zoom;
    const ty = canvasHeight / 2 - worldCenterY * zoom;

    fabricCanvas.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
    fabricCanvas.renderAll();
  };

  return (
    <div className="editor-container">
      {/* 画像ファイル選択インプット（複数選択可） */}
      <div className="file-input">
        <input type="file" accept="image/*" multiple className="file-input__control"
          onClick={e => (e.target.value = null)} onChange={uploadImage}
        />
        <small className="file-input__hint">
          （PNG/JPEG などの画像を複数選択できます）
        </small>
      </div>

      {/* 操作ボタン群：Undo / Redo / 削除 / ダウンロード */}
      <div className="button-group">
        <button className="btn" onClick={undo}>Undo</button>
        <button className="btn" onClick={redo}>Redo</button>
        <button className="btn" onClick={deleteSelected}>選択画像削除</button>
        <button className="btn" onClick={download}>ダウンロード</button>
      </div>

      {/* ガイドラインの太さ調整スライダー */}
      <div className="slider-group">
        <label>ガイドラインの太さ:</label>
        <input type="range" min="1" max="20" value={guideThickness}
          onChange={e => setGuideThickness(parseInt(e.target.value, 10))}
          style={{ '--thumb-percent': `${((guideThickness - 1) / (20 - 1)) * 100}%` }}
        />
        {guideThickness}
      </div>

      {/* 選択中オブジェクトのサイズ表示 */}
      <div className="selected-size">
        <strong>選択中画像 サイズ:</strong>
        <span className="selected-size__value">
          {selectedSize ? `幅 ${selectedSize.width.toFixed(0)} px, 高さ ${selectedSize.height.toFixed(0)} px`
            : " ー"}
        </span>
        <span className="selected-size__zoom">
          {`${Math.round(zoomLevel * 100)}%`}
        </span>
      </div>

      {/* Canvas を配置するコンテナ */}
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>

      {/* 画像一覧表示エリア（サムネイル + 画像名） */}
      {imageList.length > 0 && (
        <div className="image-list">
          {imageList.map((imgObj, index) => (
            <div key={index} className="image-list__container">
              <img src={imgObj.origSrc} onClick={() => clickImageList(imgObj)} className="image-list__item" alt={`canvas-image-${index}`} />
              <div className="image-list__filename">
                {imgObj.fileName || '不明なファイル名'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ズーム・パンの操作説明 */}
      <div className="instructions">
        <small className="instructions__text">
          {isMobile ? "ピンチでズーム、二本指ドラッグでパンが可能です。"
            : "スクロールでズーム、Altキー + ドラッグでパンできます。"}
        </small>
      </div>
    </div>
  );
};