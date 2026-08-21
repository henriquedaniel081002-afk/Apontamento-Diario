import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from './ui';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeLabel?: string;
  busy?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  renderInPortal?: boolean;
}

const sizeClasses: Record<NonNullable<ModalShellProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const openModalStack: string[] = [];

export function ModalShell({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = 'Fechar janela',
  busy = false,
  initialFocusRef,
  className,
  renderInPortal = true,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const modalInstanceId = useId();
  const titleId = useId();
  const descriptionId = useId();

  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    openModalStack.push(modalInstanceId);

    const focusTimer = window.setTimeout(() => {
      const initialTarget = initialFocusRef?.current;
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (initialTarget || firstFocusable || dialogRef.current)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openModalStack.at(-1) !== modalInstanceId) return;

      if (event.key === 'Escape') {
        if (!busyRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const stackIndex = openModalStack.lastIndexOf(modalInstanceId);
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
      previouslyFocused?.focus();
    };
  }, [initialFocusRef, isOpen, modalInstanceId]);

  if (!isOpen) return null;

  const modal = (
    <div
      className="modal-overlay ui-fade-in fixed inset-0 z-[100] flex h-[100dvh] min-h-0 w-screen max-w-full items-end justify-center overflow-hidden bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-3 lg:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={cx(
          'modal-dialog ui-slide-up flex h-auto max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#0c120e] shadow-[0_30px_90px_rgba(0,0,0,0.55)] outline-none sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-2xl lg:max-h-[calc(100dvh-2rem)]',
          sizeClasses[size],
          className,
        )}
      >
        <div className="modal-header flex shrink-0 items-start gap-3 border-b border-white/[0.08] px-4 py-3.5 min-[420px]:px-5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="break-words text-base font-extrabold tracking-tight text-white sm:text-lg">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 break-words text-sm leading-5 text-slate-400 [overflow-wrap:anywhere]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={closeLabel}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-slate-400 transition-colors hover:border-white/10 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 sm:size-11"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="modal-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 min-[420px]:px-5 sm:px-6 sm:py-5"
          data-modal-scroll="true"
        >
          {children}
        </div>

        {footer && (
          <div className="modal-footer max-h-[45dvh] shrink-0 overflow-x-hidden overflow-y-auto overscroll-contain border-t border-white/[0.08] bg-black/10 px-4 py-3 min-[420px]:px-5 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (renderInPortal && typeof document !== 'undefined') {
    return createPortal(modal, document.body);
  }

  return modal;
}
