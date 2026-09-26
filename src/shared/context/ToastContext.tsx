import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import ToastContainer from '../../components/Toast/ToastContainer';

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastItemData {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  createdAt: number;
}

export interface ToastContextType {
  toasts: ToastItemData[];
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
  toast: {
    error: (message: string, options?: ToastOptions) => string;
    warning: (message: string, options?: ToastOptions) => string;
    info: (message: string, options?: ToastOptions) => string;
    success: (message: string, options?: ToastOptions) => string;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  error: 5000,
  warning: 4500,
  info: 4000,
  success: 3500,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', options?: ToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const duration = options?.duration ?? DEFAULT_DURATIONS[type];

      const newToast: ToastItemData = {
        id,
        type,
        message,
        title: options?.title,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const toast = useMemo(
    () => ({
      error: (message: string, options?: ToastOptions) => addToast(message, 'error', options),
      warning: (message: string, options?: ToastOptions) => addToast(message, 'warning', options),
      info: (message: string, options?: ToastOptions) => addToast(message, 'info', options),
      success: (message: string, options?: ToastOptions) => addToast(message, 'success', options),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
