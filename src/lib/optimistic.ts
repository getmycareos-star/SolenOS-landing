import { useState, useCallback, useRef } from 'react';
import { postJSON, patchJSON, getJSON } from '../api/client';

interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown;
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => Promise<void> | void;
  onError?: (error: unknown, variables: TVariables, context: unknown) => Promise<void> | void;
  onSettled?: (data: TData | undefined, error: unknown | null, variables: TVariables, context: unknown) => Promise<void> | void;
}

/**
 * Supports both established call patterns:
 * 1) useOptimisticMutation(options) followed by mutate(variables)
 * 2) useOptimisticMutation() followed by mutate(options, variables)
 */
export function useOptimisticMutation<TData, TVariables>(
  defaultOptions?: OptimisticMutationOptions<TData, TVariables>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const inFlightRef = useRef<Promise<unknown> | null>(null);

  const mutate = useCallback(async (
    optionsOrVariables: OptimisticMutationOptions<TData, TVariables> | TVariables,
    maybeVariables?: TVariables,
  ): Promise<TData | undefined> => {
    const options = maybeVariables === undefined
      ? defaultOptions
      : optionsOrVariables as OptimisticMutationOptions<TData, TVariables>;
    const variables = maybeVariables === undefined
      ? optionsOrVariables as TVariables
      : maybeVariables;

    if (!options) {
      throw new Error('Mutation options must be provided either to the hook or mutate().');
    }

    // Never queue or replay a second mutation behind an in-flight request.
    // A timed-out durable write may already have reached the server.
    if (inFlightRef.current) {
      throw new Error('A mutation is already in progress. Wait for its outcome before trying again.');
    }

    setLoading(true);
    setError(null);
    let context: unknown;
    let result: TData | undefined;
    let mutationError: unknown | null = null;

    const operation = (async () => {
      try {
        context = await options.onMutate?.(variables);
        result = await options.mutationFn(variables);
        await options.onSuccess?.(result, variables, context);
        setData(result);
        return result;
      } catch (err) {
        mutationError = err;
        await options.onError?.(err, variables, context);
        setError(err);
        throw err;
      } finally {
        try {
          await options.onSettled?.(result, mutationError, variables, context);
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
  }, [defaultOptions]);

  return {
    mutate,
    loading,
    error,
    data,
    reset: () => {
      setLoading(false);
      setError(null);
      if (!inFlightRef.current) setData(null);
    },
  };
}

/**
 * Specialized optimistic mutation for toggling boolean states (like completion)
 */
export function useOptimisticToggle<TId extends string | number | symbol>() {
  const [toggledIds, setToggledIds] = useState<Set<TId>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<TId>>(new Set());
  const [errorIds, setErrorIds] = useState<Partial<Record<TId, unknown>>>({});
  
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