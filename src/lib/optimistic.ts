import { useState, useCallback, useRef } from 'react'

interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => Promise<void> | void
  onError?: (error: unknown, variables: TVariables, context: unknown) => Promise<void> | void
  onSettled?: (data: TData | undefined, error: unknown | null, variables: TVariables, context: unknown) => Promise<void> | void
}

/**
 * A single-flight mutation helper. It does not retry network writes: automatic
 * retries can duplicate non-idempotent care-record creation. Concurrent calls
 * are rejected so each operation owns its own rollback context.
 *
 * Supports:
 * 1) useOptimisticMutation(options) followed by mutate(variables)
 * 2) useOptimisticMutation() followed by mutate(options, variables)
 */
export function useOptimisticMutation<TData, TVariables>(
  defaultOptions?: OptimisticMutationOptions<TData, TVariables>,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)
  const [data, setData] = useState<TData | null>(null)
  const inFlightRef = useRef<Promise<TData | undefined> | null>(null)

  const mutate = useCallback(async (
    optionsOrVariables: OptimisticMutationOptions<TData, TVariables> | TVariables,
    maybeVariables?: TVariables,
  ): Promise<TData | undefined> => {
    const options = maybeVariables === undefined
      ? defaultOptions
      : optionsOrVariables as OptimisticMutationOptions<TData, TVariables>
    const variables = maybeVariables === undefined
      ? optionsOrVariables as TVariables
      : maybeVariables

    if (!options) {
      throw new Error('Mutation options must be provided either to the hook or mutate().')
    }
    if (inFlightRef.current) {
      throw new Error('A save is already in progress. Wait for it to finish before trying again.')
    }

    setLoading(true)
    setError(null)
    let context: unknown
    let result: TData | undefined
    let mutationError: unknown | null = null

    const operation = (async (): Promise<TData | undefined> => {
      try {
        context = await options.onMutate?.(variables)
        result = await options.mutationFn(variables)
        setData(result)
        try {
          await options.onSuccess?.(result, variables, context)
        } catch (callbackError) {
          // The server write already succeeded. A UI callback failure must not
          // misreport the write itself as failed or trigger rollback.
          console.error('Mutation onSuccess callback failed after server success:', callbackError)
        }
        return result
      } catch (err) {
        mutationError = err
        setError(err)
        try {
          await options.onError?.(err, variables, context)
        } catch (callbackError) {
          // Preserve the original save error; rollback callback errors are secondary.
          console.error('Mutation onError callback failed:', callbackError)
        }
        throw err
      } finally {
        try {
          await options.onSettled?.(result, mutationError, variables, context)
        } catch (callbackError) {
          // A cleanup callback must not turn a successful server write into a reported failure.
          console.error('Mutation onSettled callback failed:', callbackError)
        }
        setLoading(false)
      }
    })()

    inFlightRef.current = operation
    try {
      return await operation
    } finally {
      if (inFlightRef.current === operation) inFlightRef.current = null
    }
  }, [defaultOptions])

  const reset = useCallback(() => {
    // Do not clear the in-flight lock: doing so would allow overlapping writes.
    setError(null)
    setData(null)
  }, [])

  return { mutate, loading, error, data, reset }
}

/**
 * Optimistic toggle with per-ID locking and exact rollback to the prior state.
 */
export function useOptimisticToggle<TId extends string | number | symbol>() {
  const [toggledIds, setToggledIds] = useState<Set<TId>>(new Set())
  const [loadingIds, setLoadingIds] = useState<Set<TId>>(new Set())
  const [errorIds, setErrorIds] = useState<Partial<Record<TId, unknown>>>({})
  const lockedIdsRef = useRef<Set<TId>>(new Set())

  const toggle = useCallback(async (id: TId, options: {
    enableFn: () => Promise<void>
    disableFn: () => Promise<void>
  }) => {
    if (lockedIdsRef.current.has(id)) return
    lockedIdsRef.current.add(id)
    setLoadingIds(prev => new Set(prev).add(id))
    setErrorIds(prev => ({ ...prev, [id]: undefined }))

    const wasToggled = toggledIds.has(id)
    setToggledIds(prev => {
      const next = new Set(prev)
      if (wasToggled) next.delete(id)
      else next.add(id)
      return next
    })

    try {
      if (wasToggled) await options.disableFn()
      else await options.enableFn()
    } catch (err) {
      // Restore the captured prior value; do not invert a possibly newer state.
      setToggledIds(prev => {
        const next = new Set(prev)
        if (wasToggled) next.add(id)
        else next.delete(id)
        return next
      })
      setErrorIds(prev => ({ ...prev, [id]: err }))
      throw err
    } finally {
      lockedIdsRef.current.delete(id)
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [toggledIds])

  const reset = useCallback(() => {
    if (lockedIdsRef.current.size > 0) return
    setToggledIds(new Set())
    setLoadingIds(new Set())
    setErrorIds({})
  }, [])

  return {
    toggle,
    toggledIds: Array.from(toggledIds),
    loadingIds: Array.from(loadingIds),
    errorIds,
    reset,
  }
}
