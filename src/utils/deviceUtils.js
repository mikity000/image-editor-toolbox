/**
 * ユーザーエージェントおよびポインター情報から、
 * モバイル端末（スマホ・タブレット等）であるかどうかを判定します。
 * 
 * @returns {boolean} モバイル端末の場合は true
 */
export const isMobileDevice = () =>
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) 
  || window.matchMedia("(pointer: coarse)").matches;
