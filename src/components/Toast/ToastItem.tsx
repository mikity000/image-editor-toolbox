import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastItemData, ToastType } from '../../context/ToastContext';

interface ToastItemProps {
  toast: ToastItemData;
  onRemove: (id: string) => void;
}

const ICONS: Record<ToastType, React.ComponentType<{ size?: number; className?: string }>> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const DEFAULT_TITLES: Record<ToastType, string> = {
  error: 'エラー',
  warning: '注意',
  info: 'お知らせ',
  success: '完了',
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const { id, type, message, title, duration } = toast;
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(id);
    }, 250);
  }, [id, onRemove]);

  // タイマー管理（ホバー時は一時停止・解除で再開）
  useEffect(() => {
    if (isExiting) return;

    if (!isPaused) {
      startTimeRef.current = Date.now();

      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, remainingTimeRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, isExiting, handleDismiss]);

  const handleMouseEnter = () => {
    if (isExiting) return;
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    if (isExiting) return;
    setIsPaused(false);
  };

  const IconComponent = ICONS[type];
  const displayTitle = title !== undefined ? title : DEFAULT_TITLES[type];

  return (
    <div
      className={`toast-item toast-item--${type} ${isExiting ? 'toast-item--exiting' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
      aria-live="assertive"
    >
      <div className="toast-item__indicator" />
      <div className="toast-item__icon-wrapper">
        <IconComponent size={20} className="toast-item__icon" />
      </div>

      <div className="toast-item__content">
        {displayTitle && <div className="toast-item__title">{displayTitle}</div>}
        <div className="toast-item__message">{message}</div>
      </div>

      <button
        type="button"
        className="toast-item__close-btn"
        onClick={handleDismiss}
        aria-label="閉じる"
        title="閉じる"
      >
        <X size={16} />
      </button>

      {/* GPU支援のCSSアニメーションプログレスバー */}
      <div className="toast-item__progress-bar-bg">
        <div
          className="toast-item__progress-bar"
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  );
};

export default ToastItem;
