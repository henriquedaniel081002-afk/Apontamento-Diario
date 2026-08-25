import { useEffect, useRef, useState } from 'react';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import {
  LoadingProgressOperation,
  subscribeLoadingProgress,
} from '../../services/loadingProgressService';
import { ProgressLoadingState } from './ui';

export function GlobalLoadingOverlay() {
  const operationsRef = useRef(new Map<string, LoadingProgressOperation>());
  const [currentOperation, setCurrentOperation] = useState<LoadingProgressOperation | null>(null);
  const [visible, setVisible] = useState(false);
  const { progress, startProgress, completeProgress } = useLoadingProgress();

  useEffect(() => subscribeLoadingProgress((detail) => {
    if (detail.action === 'start') {
      const wasEmpty = operationsRef.current.size === 0;
      operationsRef.current.set(detail.id, detail);
      setCurrentOperation(detail);
      setVisible(true);
      if (wasEmpty) startProgress();
      return;
    }

    operationsRef.current.delete(detail.id);
    const remaining = [...operationsRef.current.values()];
    if (remaining.length) {
      setCurrentOperation(remaining[remaining.length - 1]);
      return;
    }

    void completeProgress().then(() => {
      if (operationsRef.current.size === 0) {
        setVisible(false);
        setCurrentOperation(null);
      }
    });
  }), [completeProgress, startProgress]);

  if (!visible || !currentOperation) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      aria-busy="true"
      data-testid="global-loading-progress"
    >
      <ProgressLoadingState
        progress={progress}
        label={currentOperation.label}
        description={currentOperation.description || 'Aguarde enquanto o sistema conclui a operação.'}
        className="min-h-[20rem] w-full max-w-2xl shadow-[0_30px_120px_rgba(0,0,0,.65)]"
      />
    </div>
  );
}
