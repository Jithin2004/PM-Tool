import { useState, useRef, useCallback } from 'react';

interface OptimisticState<T> {
  data: T;
  error: string | null;
  pending: boolean;
}

export function useOptimistic<T>(initialData: T) {
  const [state, setState] = useState<OptimisticState<T>>({ data: initialData, error: null, pending: false });
  const rollbackRef = useRef<T>(initialData);

  const mutate = useCallback(async (optimisticUpdate: (prev: T) => T, serverAction: () => Promise<T>) => {
    rollbackRef.current = state.data;
    const optimistic = optimisticUpdate(state.data);
    setState({ data: optimistic, error: null, pending: true });

    try {
      const server = await serverAction();
      setState({ data: server, error: null, pending: false });
      return server;
    } catch (err: any) {
      setState({ data: rollbackRef.current, error: err?.message || "We couldn't update this. Check your access.", pending: false });
      return rollbackRef.current;
    }
  }, [state.data]);

  const setData = useCallback((data: T) => {
    setState({ data, error: null, pending: false });
  }, []);

  return { ...state, mutate, setData };
}
