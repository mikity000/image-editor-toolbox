import { useRef, useCallback } from 'react';
import { serializeImages, restoreImages } from '../syncService';
import { APP_CONFIG } from '../constants/Constants';

const MAX_HISTORY_STACK = APP_CONFIG.MAX_HISTORY_STACK;



export function useUndoRedo(fabricCanvas, onRestore) {
  const undoStack = useRef([[]]);
  const redoStack = useRef([]);
  const isRestoring = useRef(false);

  const saveState = useCallback(() => {
    if (isRestoring.current || !fabricCanvas) return;
    const imgStates = serializeImages(fabricCanvas);
    undoStack.current.push(imgStates);
    if (undoStack.current.length > MAX_HISTORY_STACK) {
      undoStack.current.shift();
    }
    redoStack.current = [];
  }, [fabricCanvas]);

  const undo = useCallback(async () => {
    if (!fabricCanvas || undoStack.current.length <= 1) return;
    const current = undoStack.current.pop();
    redoStack.current.push(current);
    const previous = undoStack.current[undoStack.current.length - 1];
    
    isRestoring.current = true;
    try {
      await restoreImages(fabricCanvas, previous);
      if (onRestore) onRestore(fabricCanvas.getObjects());
    } catch (error) {
      console.error('[undo] error:', error);
    } finally {
      isRestoring.current = false;
    }
  }, [fabricCanvas, onRestore]);

  const redo = useCallback(async () => {
    if (!fabricCanvas || redoStack.current.length === 0) return;
    const state = redoStack.current.pop();
    undoStack.current.push(state);
    
    isRestoring.current = true;
    try {
      await restoreImages(fabricCanvas, state);
      if (onRestore) onRestore(fabricCanvas.getObjects());
    } catch (error) {
      console.error('[redo] error:', error);
    } finally {
      isRestoring.current = false;
    }
  }, [fabricCanvas, onRestore]);

  return { saveState, undo, redo };
}

