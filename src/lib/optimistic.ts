import { useState, useCallback, useRef } from 'react';

/**
 * Interface for optimistic mutation options
 */
interface OptimisticMutationOptions<TData, TVariables> {
  /** Function to perform the mutation */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Function to update the optimistic state */
  onMutate: (variables: TVariables) => Promise<unknown> | unknown;
  /** Function to apply the mutation result */
  onSuccess: (data: TData, variables: TVariables, context: unknown) => Promise<void> | void;
  /** Function to handle errors and rollback */
  onError: (error: unknown, variables: TVariables, context: unknown) => Promise<void> | void;
  /** Function to clean up */
  onSettled: (data: TData | undefined, error: unknown | null, variables: TVariables, context: unknown) => Promise<void> | void;
  /** Whether to retry on failure */
  retry?: boolean;
  /** Maximum number of retries */
  maxRetries?: number;
}

/**
 * Hook for performing optimistic mutations
 * 
 * @returns Object with mutate function and state
 */
export function useOptimisticMutation<TData, TVariables>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<TData | null>(null);
  
  // Ref to store the rollback data
  const snapshotRef = useRef<unknown>(null);
  
  // Ref to prevent race conditions
  const requestIdRef = useRef(0);
  
  const mutate = useCallback(
    async (options: OptimisticMutationOptions<TData, TVariables>, variables: TVariables) => {
      // Prevent multiple concurrent mutations
      if (loading) {
        if (options.retry) {
          // Wait for current request to complete before retrying
          return new Promise((resolve, reject) => {
            const checkComplete = () => {
              if (!loading) {
                mutate(options, variables).then(resolve).catch(reject);
              } else {
                setTimeout(checkComplete, 100);
              }
            };
            checkComplete();
          });
        }
        return Promise.reject(new Error('Mutation already in progress'));
      }
      
      setLoading(true);
      setError(null);
      
      // Generate a unique request ID to prevent race conditions
      const requestId = ++requestIdRef.current;
      
      try {
        // 1. Capture snapshot for potential rollback
        const snapshot = await options.onMutate(variables);
        snapshotRef.current = snapshot;
        
        // 2. Perform the mutation
        const result = await options.mutationFn(variables);
        
        // 3. Check if this is still the latest request
        if (requestId !== requestIdRef.current) {
          // A newer request has been made, ignore this result
          return;
        }
        
        // 4. Apply success update
        await options.onSuccess(result, variables, snapshot);
        setData(result);
        
        return result;
      } catch (err) {
        // 5. Handle error and rollback
        await options.onError(err, variables, snapshotRef.current);
        setError(err);
        throw err;
      } finally {
        // 6. Clean up
        if (requestId === requestIdRef.current) {
          // Only settle if this is still the latest request
          await options.onSettled(data, error, variables, snapshotRef.current);
          setLoading(false);
        }
      }
    },
    [loading, data, error]
  );
  
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