import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400" />,
    info: <Info className="w-5 h-5 text-emerald-400" />,
  };

  const borders = {
    success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
    error: 'border-rose-500/25 bg-rose-500/10 text-rose-100',
    info: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className={`p-4 rounded-xl border shadow-lg flex items-center space-x-3 ${borders[toast.type]}`}>
        <div className="shrink-0">{icons[toast.type]}</div>
        <div className="flex-1 text-xs font-semibold leading-snug">{toast.message}</div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-500 p-1 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
