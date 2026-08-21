import React, { useRef } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { Button } from './ui';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  isBusy?: boolean;
  busy?: boolean;
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
  isBusy = false,
  busy,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const modalIsBusy = busy ?? isBusy;

  const iconStyles = {
    danger: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    info: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  };

  const buttonVariant = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'primary';
  const Icon = variant === 'info' ? Info : AlertTriangle;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={modalIsBusy}
      initialFocusRef={cancelButtonRef}
      footer={
        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel} disabled={modalIsBusy}>
            {cancelLabel}
          </Button>
          <Button
            variant={buttonVariant}
            onClick={onConfirm}
            isLoading={modalIsBusy}
            loadingLabel="Processando..."
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border ${iconStyles[variant]}`}>
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div className="pt-1 text-sm leading-6 text-slate-300">{description}</div>
      </div>
    </ModalShell>
  );
};
