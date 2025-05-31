import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, FabricImage, Rect, Circle, Ellipse } from 'fabric';
import { setupSync, restoreImages } from '../syncService';

export default function CropperComponent() {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [croppingMode, setCroppingMode] = useState(null); // 'rect', 'circle'
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [drawingObject, setDrawingObject] = useState(null); // 現在描画中のトリミングオブジェクト
  const [adjustmentAmount, setAdjustmentAmount] = useState(1); // 調整量（デフォルト1px）
  // 同期用の Socket.IO インスタンス
  const socketRef = useRef(null);
  const emitSyncRef = useRef(null);
  // モバイル判定を navigator.userAgent とメディアクエリで判定
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;

  // === 背景画像外に出ないように制限 ===
  const clampToImageBounds = (obj) => {
    const canvas = fabricCanvasRef.current;
    const bg = canvas.backgroundImage;
    if (!bg) return;
    // 背景画像の表示領域
    const bgLeft = bg.left;
    const bgTop = bg.top;
    const bgRight = bgLeft + bg.getScaledWidth();
    const bgBottom = bgTop + bg.getScaledHeight();

    // オブジェクトのスケール後サイズを取得
    const objWidth = obj.getScaledWidth();
    const objHeight = obj.getScaledHeight();

    // クランプ範囲
    const minLeft = bgLeft;
    const maxLeft = bgRight - objWidth;
    const minTop = bgTop;
    const maxTop = bgBottom - objHeight;

    // left/top を制限
    const clampedLeft = Math.min(Math.max(obj.left, minLeft), maxLeft);
    const clampedTop = Math.min(Math.max(obj.top, minTop), maxTop);

    obj.set({ left: clampedLeft, top: clampedTop });
    obj.setCoords();
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const wrapperEl = canvasRef.current.parentElement;
    const canvas = new Canvas(canvasRef.current, {
      selection: false, // オブジェクトの選択を無効にする
      hoverCursor: 'default',
      width: wrapperEl.clientWidth,
      height: wrapperEl.clientHeight,
    });
    fabricCanvasRef.current = canvas;

    // 汎用同期サービスをセットアップ
    // const { socket, emitSync } = setupSync(canvas, {
    //   url: 'http://192.000.0.0:3000',
    //   onReceive: states => restoreImages(canvas, states).then(() => setImageLoaded(true)),
    //   autoSync: false,    // 同期先でトリミング枠を消さないため自動同期をオフ
    // });
    // socketRef.current = socket;
    // emitSyncRef.current = emitSync;

    // イベントリスナーのクリーンアップ
    return () => {
      //socket.disconnect();
      canvas.dispose();
    };
  }, []);

  // 画像ファイルの読み込み
  const uploadImage = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataURL = event.target.result;
      const canvas = fabricCanvasRef.current;

      // 既存オブジェクトをクリア
      canvas.clear();
      setCroppedImageUrl(null);

      // HTMLImage を作って読み込む
      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';
      imgEl.src = dataURL;
      imgEl.onload = () => {
        // Fabric 側のキャンバスサイズ
        const canvasW = canvas.getWidth();
        const canvasH = canvas.getHeight();
        const scaleX = canvasW / imgEl.width;
        const scaleY = canvasH / imgEl.height;
        const scale = Math.min(scaleX, scaleY); // 縦横比を維持しつつ、両方が収まる最小スケール

        // スケール後の画像の実際の幅と高さを計算
        const scaledWidth = imgEl.width * scale;
        const scaledHeight = imgEl.height * scale;

        // Canvasの中央に配置するためのleftとtopを計算
        const left = (canvasW - scaledWidth) / 2;
        const top = (canvasH - scaledHeight) / 2;

        // FabricImage インスタンス化
        const fabricImg = new FabricImage(imgEl, {
          left: left, // 計算したleftを設定
          top: top, // 計算したtopを設定
          scaleX: scale, // 計算したスケールを設定
          scaleY: scale, // 計算したスケールを設定
          selectable: false,
          evented: false,
        });

        fabricImg.origSrc = dataURL;
        canvas.backgroundImage = fabricImg;
        canvas.renderAll();
        setImageLoaded(true);
        //emitSyncRef.current?.({ includeBackground: true, includeImages: false });
      };
    };

    reader.readAsDataURL(file);
  };

  // トリミングモードの選択
  const startCropping = useCallback((mode) => {
    setCroppingMode(mode);
    setDrawingObject(null); // 前の描画オブジェクトをクリア

    const canvas = fabricCanvasRef.current;
    if (!canvas) return; // Canvasがnullやundefined(未初期化)だったらreturn

    // 既存のトリミング枠があれば削除
    canvas.getObjects().forEach(obj => canvas.remove(obj));

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    let startPoint;
    let currentShape;

    canvas.on('mouse:down', (options) => {
      if (!imageLoaded || drawingObject) return; // 画像が読み込まれていない、またはすでに描画中の場合は何もしない
      if (canvas.getObjects().some(o => o.isCroppingShape)) return; // 既にトリミング枠があるなら新しく作らない
      startPoint = canvas.getPointer(options.e);

      currentShape = mode == 'rect' ? new Rect({ width: 0, height: 0 }) : new Circle({ radius: 0 });
      currentShape.left = startPoint.x;
      currentShape.top = startPoint.y;
      currentShape.fill = 'transparent'; // 半透明のオーバーレイ
      currentShape.stroke = 'red';
      currentShape.strokeWidth = 1;
      currentShape.strokeUniform = true;
      currentShape.borderColor = 'red';
      currentShape.cornerColor = 'green'; // つまみの部分
      currentShape.cornerSize = 10;
      currentShape.transparentCorners = false;
      currentShape.hasControls = true;
      currentShape.hasBorders = true;
      currentShape.isCroppingShape = true; // トリミング形状であることを示すカスタムプロパティ
      currentShape.setControlsVisibility({ mtr: false });
      canvas.add(currentShape);
      // トリミング枠移動・リサイズ時に背景画像外に出ないよう制限
      canvas.on('object:moving', ({ target }) => clampToImageBounds(target));
      canvas.on('object:scaling', ({ target }) => clampToImageBounds(target));
      setDrawingObject(currentShape);
    });

    canvas.on('mouse:move', (options) => {
      if (!currentShape) return;
      const pointer = canvas.getPointer(options.e);

      if (mode === 'rect') {
        currentShape.set({
          width: Math.abs(pointer.x - startPoint.x),
          height: Math.abs(pointer.y - startPoint.y),
          left: Math.min(pointer.x, startPoint.x),
          top: Math.min(pointer.y, startPoint.y),
        });
      } else if (mode === 'circle') {
        const radius = Math.max(Math.abs(pointer.x - startPoint.x), Math.abs(pointer.y - startPoint.y)) / 2;
        currentShape.set({
          radius: radius,
          left: startPoint.x - radius,
          top: startPoint.y - radius,
        });
      }
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      if (currentShape) {
        currentShape.setCoords(); // リサイズハンドルの位置を更新
        setDrawingObject(currentShape);
        currentShape = null;
      }
    });
  }, [imageLoaded]); // imageLoaded を依存配列に追加

  // ↓↓↓ 追加箇所: トリミング枠を調整する関数 ↓↓↓
  const adjustCroppingShape = useCallback((side, direction) => {
    if (!drawingObject) return;

    const canvas = fabricCanvasRef.current;
    const amount = adjustmentAmount * direction; // direction: -1で狭める、1で広げる

    if (drawingObject.type === 'rect') {
      let newLeft = drawingObject.left;
      let newTop = drawingObject.top;
      let newWidth = drawingObject.width;
      let newHeight = drawingObject.height;

      switch (side) {
        case 'top':
          newTop -= amount;
          newHeight += amount;
          break;
        case 'right':
          newWidth += amount;
          break;
        case 'bottom':
          newHeight += amount;
          break;
        case 'left':
          newLeft -= amount;
          newWidth += amount;
          break;
        default:
          return;
      }

      // 最小サイズを考慮 (例: 10px以下にならないように)
      if (newWidth < 10) newWidth = 10;
      if (newHeight < 10) newHeight = 10;

      drawingObject.set({
        left: newLeft,
        top: newTop,
        width: newWidth,
        height: newHeight,
      });
    } else if (drawingObject.type === 'circle' || drawingObject.type === 'ellipse') { // Circleの場合もEllipseとして扱う
      let currentRx = drawingObject.rx || drawingObject.radius; // Circleの場合はradiusを使う
      let currentRy = drawingObject.ry || drawingObject.radius; // Circleの場合はradiusを使う
      let currentLeft = drawingObject.left;
      let currentTop = drawingObject.top;

      // 現在の楕円の中心座標を計算 (Fabric.jsのEllipseはrx, ryがleft/topからの距離なのでスケール済み)
      // もしオブジェクトがCircleで、まだEllipseに変換されていない場合
      // Circleのleft/topはバウンディングボックスの左上隅なので、中心座標は left + radius
      const currentScaleX = drawingObject.scaleX || 1;
      const currentScaleY = drawingObject.scaleY || 1;

      const adjustedAmountX = amount / currentScaleX;
      const adjustedAmountY = amount / currentScaleY;
      switch (side) {
        case 'top':
          currentRy += adjustedAmountY / 2; // 半径を調整
          currentTop -= drawingObject.type === 'circle' ? adjustedAmountY : amount; // 上辺を固定するためにオブジェクトのtopを調整
          break;
        case 'right':
          currentRx += adjustedAmountX / 2; // 調整量分、水平半径を増減
          break;
        case 'bottom':
          currentRy += adjustedAmountY / 2; // 調整量分、垂直半径を増減
          break;
        case 'left':
          currentRx += adjustedAmountX / 2; // 半径を調整
          currentLeft -= drawingObject.type === 'circle' ? adjustedAmountX : amount; // 左辺を固定するためにオブジェクトのleftを調整
          break;
        default:
          return;
      }

      // 最小サイズを考慮 (見た目の半径が5px以下にならないように)
      const minVisibleRx = 5 / currentScaleX;
      const minVisibleRy = 5 / currentScaleY;

      currentRx = Math.max(currentRx, minVisibleRx);
      currentRy = Math.max(currentRy, minVisibleRy);

      // オブジェクトのタイプがまだ 'circle' の場合は 'ellipse' に変換
      if (drawingObject.type === 'circle') {
        canvas.getObjects().forEach(obj => canvas.remove(obj)); // 古いCircleオブジェクトを削除
        const newEllipse = new Ellipse({
          left: currentLeft, // 新しいrxに基づいてleftを計算
          top: currentTop, // 新しいryに基づいてtopを計算
          rx: currentRx,
          ry: currentRy,
          fill: 'transparent',
          stroke: 'red',
          strokeWidth: 1,
          strokeUniform: true,
          borderColor: 'red',
          cornerColor: 'green',
          cornerSize: 10,
          transparentCorners: false,
          hasControls: true,
          hasBorders: true,
          isCroppingShape: true,
          scaleX: currentScaleX, // 元のスケールを維持
          scaleY: currentScaleY, // 元のスケールを維持
        });
        newEllipse.setControlsVisibility({ mtr: false });
        canvas.add(newEllipse);
        setDrawingObject(newEllipse);
        canvas.setActiveObject(newEllipse); // 選択状態にする (コントロールを表示するため)
      } else {
        // 既にEllipseの場合は直接プロパティを更新
        drawingObject.set({
          left: currentLeft,
          top: currentTop,
          rx: currentRx,
          ry: currentRy,
        });
      }
    }

    drawingObject.setCoords(); // リサイズハンドルの位置を更新
    canvas.renderAll();
  }, [drawingObject, adjustmentAmount]);
  // ↑↑↑ 追加箇所終わり ↑↑↑

  // トリミングの実行
  const crop = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const image = canvas.backgroundImage;
    if (!image || !image._element) return; // _element は基になる HTMLImageElement

    // ↓↓↓ 修正箇所：高画質トリミングと正しい範囲抽出のためのロジック開始 ↓↓↓
    // 元の HTMLImageElement からオリジナル画像の寸法を取得
    const originalImageWidth = image._element.naturalWidth;
    const originalImageHeight = image._element.naturalHeight;

    // 表示されている画像 (image) のスケールと位置から、
    // キャンバス座標を元の画像ピクセル座標に変換するためのスケールファクターを計算
    const scaleFactorX = originalImageWidth / image.getScaledWidth();
    const scaleFactorY = originalImageHeight / image.getScaledHeight();

    // トリミング形状のバウンディングボックスをキャンバス表示座標で取得
    const bounds = drawingObject.getBoundingRect();

    // 表示されている画像がキャンバスのどこに配置されているかを計算
    const imageDisplayLeft = image.left;
    const imageDisplayTop = image.top;

    // トリミング領域の座標と寸法を *元の画像ピクセル空間* で計算します。
    // これらの座標は、元の画像のコンテンツの左上隅を基準としています。
    const cropLeftInOriginalPixels = Math.round((bounds.left - imageDisplayLeft) * scaleFactorX);
    const cropTopInOriginalPixels = Math.round((bounds.top - imageDisplayTop) * scaleFactorY);
    const cropWidthInOriginalPixels = Math.round(bounds.width * scaleFactorX);
    const cropHeightInOriginalPixels = Math.round(bounds.height * scaleFactorY);

    // 一時的なオフスクリーン Fabric.js Canvas を作成します。
    // このキャンバスは、フル解像度でトリミング処理を行うために、元の画像の寸法全体で作成します。
    const tempCanvas = new Canvas(null, {
      width: originalImageWidth,
      height: originalImageHeight,
    });

    // 元の HTML 画像要素から新しい FabricImage インスタンスを作成します。
    // これにより、フル解像度の画像データで作業していることを保証します。
    const fullResImage = new FabricImage(image._element, {
      left: 0, // フル解像度の画像をtempCanvasの(0,0)に配置
      top: 0,
      selectable: false,
      evented: false,
    });

    // クリップパスオブジェクトを定義します。その座標はtempCanvasの絶対座標（元の画像空間）に基づきます。
    let clipPathObject;

    if (croppingMode === 'rect') {
      clipPathObject = new Rect({
        left: cropLeftInOriginalPixels,
        top: cropTopInOriginalPixels,
        width: cropWidthInOriginalPixels,
        height: cropHeightInOriginalPixels,
        absolutePositioned: true, // 重要: クリップパスの座標はtempCanvasの絶対座標
      });
    } else if (croppingMode === 'circle') {
      // 元の画像ピクセル空間での、楕円の横方向半径 (rx) と縦方向半径 (ry) を計算
      const rxInOriginalPixels = Math.round(cropWidthInOriginalPixels / 2);
      const ryInOriginalPixels = Math.round(cropHeightInOriginalPixels / 2);

      // 元の画像ピクセル空間での、トリミング枠の中心座標を計算
      // bounds.left/top は表示キャンバス上のバウンディングボックスの左上隅
      // bounds.width/height は表示キャンバス上のバウンディングボックスの寸法
      const centerXInOriginalPixels = Math.round(((bounds.left + bounds.width / 2) - imageDisplayLeft) * scaleFactorX);
      const centerYInOriginalPixels = Math.round(((bounds.top + bounds.height / 2) - imageDisplayTop) * scaleFactorY);

      // drawingObjectのスケールXとスケールYが異なる場合（楕円になっている場合）は、
      // クリップパスをfabric.Ellipseとして作成します。
      // 浮動小数点誤差を考慮して、わずかな差は許容します。
      if (Math.abs(drawingObject.scaleX - drawingObject.scaleY) > 0.001 || drawingObject.type === 'ellipse') {
        // 楕円としてトリミング
        clipPathObject = new Ellipse({
          // Ellipseのleft/topはそのバウンディングボックスの左上隅なので、中心から半径を引く
          left: centerXInOriginalPixels - rxInOriginalPixels,
          top: centerYInOriginalPixels - ryInOriginalPixels,
          rx: rxInOriginalPixels, // 横方向半径
          ry: ryInOriginalPixels, // 縦方向半径
          absolutePositioned: true, // クリップパスの座標がtempCanvasの絶対座標であることを保証
        });
      } else {
        // ほぼ円形である場合は、引き続きCircleとしてトリミング
        clipPathObject = new Circle({
          left: centerXInOriginalPixels - rxInOriginalPixels, // rxとryはほぼ同じ値になるはず
          top: centerYInOriginalPixels - ryInOriginalPixels,
          radius: rxInOriginalPixels, // radiusはrxまたはryのどちらかを使用
          absolutePositioned: true,
        });
      }
    }

    fullResImage.clipPath = clipPathObject;
    tempCanvas.add(fullResImage);
    tempCanvas.renderAll();

    // tempCanvasからトリミング結果の画像データを取得します。
    // toDataURLのleft/top/width/heightパラメータを使用して、正確なトリミング領域を抽出します。
    const maskBounds = clipPathObject.getBoundingRect(true, true);
    const finalCroppedImage = tempCanvas.toDataURL({
      format: 'png',
      multiplier: 1, // tempCanvas上の解像度を維持
      left: Math.round(maskBounds.left),
      top: Math.round(maskBounds.top),
      width: Math.round(maskBounds.width),
      height: Math.round(maskBounds.height),
    });

    setCroppedImageUrl(finalCroppedImage);
    // ↑↑↑ 修正箇所：高画質トリミングと正しい範囲抽出のためのロジック終了 ↑↑↑

    // 元のキャンバスにトリミング形状を戻す
    canvas.add(drawingObject);
    image.clipPath = undefined; // クリップパスを解除
    canvas.renderAll();

    // 一時キャンバスを破棄してメモリを解放
    tempCanvas.dispose();
  }, [drawingObject, croppingMode]);

  // リセット
  const reset = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    // リセット時に残っているマウスイベントを全てオフに
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    setCroppedImageUrl(null);
    setCroppingMode(null);
    setDrawingObject(null);
  }, []);

  return (
    <div className="editor-container">
      {/* 画像アップロード */}
      <div style={{ marginBottom: '20px' }}>
        <input type="file" accept="image/*" className="file-input__control" onClick={e => e.target.value = null} onChange={uploadImage} />
      </div>

      {/* トリミング操作ボタン */}
      <div className="button-group">
        <button onClick={() => startCropping('rect')} className="btn">四角形</button>
        <button onClick={() => startCropping('circle')} className="btn">円</button>
        <button onClick={crop} className="btn btn--success" disabled={!drawingObject}>トリミング実行</button>
        <button onClick={reset} className="btn btn--danger">リセット</button>
      </div>

      {/* トリミング枠調整ボタン */}
      <div className="adjustment-controls">
        <h3>トリミング枠の調整 (1px単位)</h3>
        <div className="adjustment-group">
          {['top', 'left', 'right', 'bottom'].map((side) => (
            <div key={side} className="adjustment-box">
              <h4>{{ 'top': '上辺', 'left': '左辺', 'right': '右辺', 'bottom': '下辺' }[side]}</h4>
              <button onClick={() => adjustCroppingShape(side, -1)} className="btn">-1</button>
              <button onClick={() => adjustCroppingShape(side, 1)} className="btn">+1</button>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="canvas-wrapper" style={{ height: isMobile ? '600px' : '800px' }}>
        <canvas ref={canvasRef} />
      </div>

      {/* トリミング結果 */}
      {croppedImageUrl && (
        <div className="result-container">
          <h2 className="result-title">トリミング結果</h2>
          <img src={croppedImageUrl} alt="Cropped Result" id="croppedResult" />
          <div>
            <a href={croppedImageUrl} download="cropped_image.png" className="btn download-btn">画像をダウンロード</a>
          </div>
        </div>
      )}
    </div>
  );
};