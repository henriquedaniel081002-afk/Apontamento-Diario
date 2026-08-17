import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from './ui';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
  duration?: number;
}

const toastStyles: Record<ToastMessage['type'], string> = {
  success: 'border-emerald-400/25 bg-[#0c1c14] text-emerald-50',
  error: 'border-rose-400/30 bg-[#211014] text-rose-50',
  warning: 'border-amber-400/30 bg-[#211a0c] text-amber-50',
  info: 'border-sky-400/25 bg-[#0c1820] text-sky-50',
};

const iconStyles: Record<ToastMessage['type'], string> = {
  success: 'text-emerald-300',
  error: 'text-rose-300',
  warning: 'text-amber-300',
  info: 'text-sky-300',
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

export const ToastViewport: React.FC<ToastProps> = ({ toast, onClose, duration = 4500 }) => {
  useEffect(() => {
    if (!toast || duration <= 0) return undefined;

    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose, toast]);

  if (!toast) return null;

  const Icon = icons[toast.type];
  const isError = toast.type === 'error';

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex justify-end sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(24rem,calc(100vw-2.5rem))]"
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div
        role={isError ? 'alert' : 'status'}
        className={cx(
          'toast-enter pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-[0_20px_55px_rgba(0,0,0,0.42)]',
          toastStyles[toast.type],
        )}
      >
        <Icon className={cx('mt-0.5 size-5 shrink-0', iconStyles[toast.type])} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{toast.message}</p>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onClose();
              }}
              className="mt-2 min-h-8 rounded-lg px-1 text-xs font-extrabold text-current underline decoration-current/40 underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar notificação"
          className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-xl text-current/65 transition-colors hover:bg-white/[0.08] hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export const Toast = ToastViewport;
