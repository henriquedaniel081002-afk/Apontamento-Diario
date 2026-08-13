import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-rose-500/15 text-rose-400',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
    },
    warning: {
      iconBg: 'bg-amber-500/15 text-amber-400',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    },
    info: {
      iconBg: 'bg-emerald-500/15 text-emerald-400',
      btn: 'bg-emerald-500 hover:bg-emerald-400 text-[#041007] focus:ring-emerald-500',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0D120F] rounded-xl max-w-md w-full p-6 shadow-xl border border-white/10 relative transform transition-all scale-100">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-xl ${style.iconBg} shrink-0`}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-bold text-slate-100">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg transition-colors border border-white/10"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-offset-1 ${style.btn}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
