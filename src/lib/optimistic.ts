import { useState, useCallback, useRef } from 'react';

/**
 * Configuration for a mutation and its lifecycle callbacks.
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
 * Supports both configured usage (useOptimisticMutation(options), mutate(variables))
 * and per-call usage (useOptimisticMutation(), mutate(options, variables)).
 */
export function useOptimisticMutation<TData = unknown, TVariables = unknown>(
  configuredOptions?: OptimisticMutationOptions<TData, TVariables>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const snapshotRef = useRef<unknown>(null);
  const requestIdRef = useRef(0);

  const mutate = useCallback(async (
    optionsOrVariables: OptimisticMutationOptions<TData, TVariables> | TVariables,
    maybeVariables?: TVariables
  ): Promise<TData> => {
    const options = configuredOptions ?? optionsOrVariables as OptimisticMutationOptions<TData, TVariables>;
    const variables = configuredOptions
      ? optionsOrVariables as TVariables
      : maybeVariables as TVariables;

    if (!configuredOptions && maybeVariables === undefined) {
      throw new Error('Mutation variables are required when options are supplied per call.');
    }
    if (loading) {
      throw new Error('Mutation already in progress');
    }

    setLoading(true);
    setError(null);
    const requestId = ++requestIdRef.current;
    let resultData: TData | undefined;
    let mutationError: unknown | null = null;
    let snapshot: unknown = null;

    try {
      snapshot = await options.onMutate(variables);
      snapshotRef.current = snapshot;

      const maxRetries = options.retry ? Math.max(0, options.maxRetries ?? 0) : 0;
      let attempt = 0;
      let result: TData;
      while (true) {
        try {
          result = await options.mutationFn(variables);
          break;
        } catch (err) {
          if (attempt >= maxRetries) throw err;
          attempt += 1;
        }
      }
      resultData = result;

      if (requestId === requestIdRef.current) {
        await options.onSuccess(result, variables, snapshot);
        setData(result);
      }
      return result;
    } catch (err) {
      mutationError = err;
      setError(err);
      try {
        await options.onError(err, variables, snapshot);
      } catch (callbackError) {
        console.error('Optimistic mutation onError callback failed:', callbackError);
      }
      throw err;
    } finally {
      if (requestId === requestIdRef.current) {
        try {
          await options.onSettled(resultData, mutationError, variables, snapshot);
        } finally {
          setLoading(false);
        }
      }
    }
  }, [configuredOptions, loading]);

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
      requestIdRef.current = 0;
    }
  };
}

/**
 * Specialized optimistic mutation for toggling boolean states (like completion)
 */
export function useOptimisticToggle<TId extends string | number | symbol>() {
  const [toggledIds, setToggledIds] = useState<Set<TId>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<TId>>(new Set());
  const [errorIds, setErrorIds] = useState<Record<TId, unknown>>({} as Record<TId, unknown>);
  
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