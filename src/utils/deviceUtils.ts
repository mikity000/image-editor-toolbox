/**
 * ユーザーエージェントおよびポインター情報から、
 * モバイル端末（スマホ・タブレット等）であるかどうかを判定します。
 * 
 * @returns モバイル端末の場合は true
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) 
    || Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
};
