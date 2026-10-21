import { useState, useCallback, useRef } from 'react';

/**
 * Options for a single optimistic mutation.
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
 * Run one mutation at a time. The options are bound when the hook is created;
 * callers pass only the mutation variables to mutate().
 */
export function useOptimisticMutation<TData, TVariables>(options: OptimisticMutationOptions<TData, TVariables>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const inFlightRef = useRef(false);

  const mutate = useCallback(async (variables: TVariables): Promise<TData> => {
    if (inFlightRef.current) {
      throw new Error('Mutation already in progress');
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    let context: unknown;
    let result: TData | undefined;
    let failure: unknown | null = null;

    try {
      context = await options.onMutate(variables);
      result = await options.mutationFn(variables);
      await options.onSuccess(result, variables, context);
      setData(result);
      return result;
    } catch (cause) {
      failure = cause;
      try {
        await options.onError(cause, variables, context);
      } finally {
        setError(cause);
      }
      throw cause;
    } finally {
      try {
        await options.onSettled(result, failure, variables, context);
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [options]);

  return {
    mutate,
    loading,
    error,
    data,
    reset: () => {
      if (inFlightRef.current) return;
      setLoading(false);
      setError(null);
      setData(null);
    },
  };
}

/** Specialized optimistic mutation for toggling boolean states. */
export function useOptimisticToggle<TId>() {
  const [toggledIds, setToggledIds] = useState<Set<TId>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<TId>>(new Set());
  const [errorIds, setErrorIds] = useState<Record<string, unknown>>({});

  const toggle = useCallback(async (id: TId, options: {
    enableFn: () => Promise<void>;
    disableFn: () => Promise<void>;
  }) => {
    if (loadingIds.has(id)) return;

    setLoadingIds(prev => new Set(prev).add(id));
    setErrorIds(prev => ({ ...prev, [String(id)]: undefined }));

    const currentlyToggled = toggledIds.has(id);
    setToggledIds(prev => {
      const next = new Set(prev);
      if (currentlyToggled) next.delete(id);
      else next.add(id);
      return next;
    });

    try {
      if (currentlyToggled) await options.disableFn();
      else await options.enableFn();
    } catch (cause) {
      setToggledIds(prev => {
        const next = new Set(prev);
        if (currentlyToggled) next.add(id);
        else next.delete(id);
        return next;
      });
      setErrorIds(prev => ({ ...prev, [String(id)]: cause }));
      throw cause;
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [toggledIds, loadingIds]);

  return {
    toggle,
    toggledIds: Array.from(toggledIds),
    loadingIds: Array.from(loadingIds),
    errorIds,
    reset: () => {
      setToggledIds(new Set());
      setLoadingIds(new Set());
      setErrorIds({});
    },
  };
}
