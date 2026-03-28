import { useRef } from 'react';
import { serializeImages, restoreImages } from '../syncService';

export function useUndoRedo(fabricCanvas, onRestore) {
  const undoStack = useRef([[]]);
  const redoStack = useRef([]);
  const isRestoring = useRef(false);

  const saveState = () => {
    if (isRestoring.current || !fabricCanvas) return;
    const imgStates = serializeImages(fabricCanvas);
    undoStack.current.push(imgStates);
    redoStack.current = [];
  };

  const undo = async () => {
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
  };

  const redo = async () => {
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
  };

  return { saveState, undo, redo };
}
