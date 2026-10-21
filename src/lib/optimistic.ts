import { useState, useCallback, useRef } from 'react';
import { postJSON, patchJSON, getJSON } from '../api/client';

/**
 * Interface for optimistic mutation options
 */
interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate: (variables: TVariables) => Promise<unknown> | unknown;
  onSuccess: (data: TData, variables: TVariables, context: unknown) => Promise<void> | void;
  onError: (error: unknown, variables: TVariables, context: unknown) => Promise<void> | void;
  onSettled: (data: TData | undefined, error: unknown | null, variables: TVariables, context: unknown) => Promise<void> | void;
  retry?: boolean;
  maxRetries?: number;
}

/**
 * Runs mutations with rollback hooks and a ref-backed in-flight lock.
 * The ref prevents duplicate requests even before React has rerendered.
 */
export function useOptimisticMutation<TData, TVariables>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const snapshotRef = useRef<unknown>(null);

  const mutate = useCallback(async (
    options: OptimisticMutationOptions<TData, TVariables>,
    variables: TVariables,
  ): Promise<TData | undefined> => {
    const existing = inFlightRef.current;
    if (existing) {
      if (!options.retry) {
        throw new Error('Mutation already in progress');
      }
      // Retry means queue this mutation behind the current one; do not poll
      // React state or reuse a stale closure.
      await existing.catch(() => undefined);
      return mutate(options, variables);
    }

    setLoading(true);
    setError(null);
    let context: unknown;
    let result: TData | undefined;
    let mutationError: unknown | null = null;

    const operation = (async () => {
      try {
        context = await options.onMutate(variables);
        snapshotRef.current = context;
        result = await options.mutationFn(variables);
        await options.onSuccess(result, variables, context);
        setData(result);
        return result;
      } catch (err) {
        mutationError = err;
        await options.onError(err, variables, context);
        setError(err);
        throw err;
      } finally {
        try {
          await options.onSettled(result, mutationError, variables, context);
        } finally {
          setLoading(false);
        }
      }
    })();

    inFlightRef.current = operation;
    try {
      return await operation;
    } finally {
      if (inFlightRef.current === operation) {
        inFlightRef.current = null;
      }
    }
  }, []);

  return {
    mutate,
    loading,
    error,
    data,
    reset: () => {
      setLoading(false);
      setError(null);
      setData(null);
      snapshotRef.current = null;
      inFlightRef.current = null;
    },
  };
}

/**
 * Specialized optimistic mutation for toggling boolean states (like completion)
 */
export function useOptimisticToggle<TId>() {
  const [toggledIds, setToggledIds] = useState<Set<TId>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<TId>>(new Set());
  const [errorIds, setErrorIds] = useState<Record<TId, unknown>>({});
  
  const toggle = useCallback(
    async (id: TId, options: {
      enableFn: () => Promise<void>;
      disableFn: () => Promise<void>;
    }) => {
      // Prevent multiple concurrent toggles on the same ID
      if (loadingIds.has(id)) {
        return;
      }
      
      setLoadingIds(prev => new Set(prev).add(id));
      setErrorIds(prev => ({ ...prev, [id]: undefined }));
      
      try {
        // Optimistically toggle the state
        setToggledIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        
        // Perform the actual mutation
        const currentlyToggled = toggledIds.has(id);
        if (currentlyToggled) {
          await options.disableFn();
        } else {
          await options.enableFn();
        }
        
        // Success - state already optimistically updated
      } catch (err) {
        // Rollback - revert the optimistic update
        setToggledIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        
        setErrorIds(prev => ({ ...prev, [id]: err }));
        throw err;
      } finally {
        setLoadingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [toggledIds]
  );
  
  return {
    toggle,
    toggledIds: Array.from(toggledIds),
    loadingIds: Array.from(loadingIds),
    errorIds,
    reset: () => {
      setToggledIds(new Set());
      setLoadingIds(new Set());
      setErrorIds({});
    }
  };
}