import { useCallback, useEffect, useRef, useState } from 'react';

const COMPLETE_HOLD_MS = 180;

export function useLoadingProgress() {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopTimer();
    setProgress(0);
    timerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 94) return current;
        if (current < 28) return Math.min(94, current + 7);
        if (current < 60) return Math.min(94, current + 4);
        if (current < 82) return Math.min(94, current + 2);
        return Math.min(94, current + 1);
      });
    }, 95);
  }, [stopTimer]);

  const completeProgress = useCallback(async () => {
    stopTimer();
    setProgress(100);
    await new Promise<void>((resolve) => window.setTimeout(resolve, COMPLETE_HOLD_MS));
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  return { progress, startProgress, completeProgress };
}
