export interface LoadingProgressOperation {
  id: string;
  label: string;
  description?: string;
}

type LoadingProgressEventDetail =
  | ({ action: 'start' } & LoadingProgressOperation)
  | { action: 'finish'; id: string };

const EVENT_NAME = 'itam:loading-progress';
const activeOperations = new Map<string, LoadingProgressOperation>();
let sequence = 0;

function dispatch(detail: LoadingProgressEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LoadingProgressEventDetail>(EVENT_NAME, { detail }));
}

export function startLoadingProgress(label: string, description?: string): string {
  sequence += 1;
  const operation = {
    id: `loading-${Date.now()}-${sequence}`,
    label,
    description,
  };
  activeOperations.set(operation.id, operation);
  dispatch({ action: 'start', ...operation });
  return operation.id;
}

export function finishLoadingProgress(id: string) {
  activeOperations.delete(id);
  dispatch({ action: 'finish', id });
}

export function subscribeLoadingProgress(
  listener: (detail: LoadingProgressEventDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    listener((event as CustomEvent<LoadingProgressEventDetail>).detail);
  };

  window.addEventListener(EVENT_NAME, handler);
  activeOperations.forEach((operation) => listener({ action: 'start', ...operation }));
  return () => window.removeEventListener(EVENT_NAME, handler);
}
