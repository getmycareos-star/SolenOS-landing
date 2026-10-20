import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticMutation } from '../optimistic';

describe('useOptimisticMutation', () => {
  const defaultOptions = {
    mutationFn: async (value: unknown) => value,
    onMutate: () => undefined,
    onSuccess: () => undefined,
    onError: () => undefined,
    onSettled: () => undefined,
  };

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useOptimisticMutation(defaultOptions));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('runs a successful mutation and reports its result', async () => {
    const mockData = { id: '123', name: 'Test' };
    const mutationFn = jest.fn().mockResolvedValue(mockData);
    const onMutate = jest.fn().mockResolvedValue({ snapshot: 'test' });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onSettled = jest.fn();
    const options = { mutationFn, onMutate, onSuccess, onError, onSettled };
    const { result } = renderHook(() => useOptimisticMutation(options));

    await act(async () => {
      await result.current.mutate({ test: 'variable' });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(onMutate).toHaveBeenCalledWith({ test: 'variable' });
    expect(mutationFn).toHaveBeenCalledWith({ test: 'variable' });
    expect(onSuccess).toHaveBeenCalledWith(mockData, { test: 'variable' }, { snapshot: 'test' });
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(mockData, null, { test: 'variable' }, { snapshot: 'test' });
  });

  it('reports mutation errors and runs settlement callbacks', async () => {
    const mockError = new Error('Test error');
    const mutationFn = jest.fn().mockRejectedValue(mockError);
    const onMutate = jest.fn().mockResolvedValue({ snapshot: 'test' });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onSettled = jest.fn();
    const options = { mutationFn, onMutate, onSuccess, onError, onSettled };
    const { result } = renderHook(() => useOptimisticMutation(options));

    await act(async () => {
      await expect(result.current.mutate({ test: 'variable' })).rejects.toBe(mockError);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(mockError);
    expect(onMutate).toHaveBeenCalledWith({ test: 'variable' });
    expect(mutationFn).toHaveBeenCalledWith({ test: 'variable' });
    expect(onError).toHaveBeenCalledWith(mockError, { test: 'variable' }, { snapshot: 'test' });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(undefined, mockError, { test: 'variable' }, { snapshot: 'test' });
  });

  it('rejects concurrent mutations instead of running both', async () => {
    let resolveMutation!: (value: string) => void;
    const mutationFn = jest.fn(() => new Promise<string>((resolve) => {
      resolveMutation = resolve;
    }));
    const options = {
      mutationFn,
      onMutate: () => ({}),
      onSuccess: () => undefined,
      onError: () => undefined,
      onSettled: () => undefined,
    };
    const { result } = renderHook(() => useOptimisticMutation(options));

    let firstPromise!: Promise<string>;
    act(() => {
      firstPromise = result.current.mutate({ id: 'first' });
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await expect(result.current.mutate({ id: 'second' })).rejects.toThrow('Mutation already in progress');
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMutation('done');
      await firstPromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('done');
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});
