import { renderHook, act, waitFor } from '@testing-library/react';
import { useOptimisticMutation } from '../optimistic';

// Mock the API client functions
jest.mock('../../api/client', () => ({
  postJSON: jest.fn(),
  patchJSON: jest.fn(),
  getJSON: jest.fn(),
}));

describe('useOptimisticMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useOptimisticMutation());
    
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.data).toBe(null);
  });

  it('should handle successful mutation', async () => {
    const mockData = { id: '123', name: 'Test' };
    let resolveMutation!: (value: typeof mockData) => void;
    const mutationFn = jest.fn(() => new Promise<typeof mockData>((resolve) => {
      resolveMutation = resolve;
    }));
    const onMutate = jest.fn().mockResolvedValue({ snapshot: 'test' });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onSettled = jest.fn();
    const { result } = renderHook(() => useOptimisticMutation<typeof mockData, { test: string }>());

    let promise!: Promise<typeof mockData | undefined>;
    act(() => {
      promise = result.current.mutate(
        { mutationFn, onMutate, onSuccess, onError, onSettled },
        { test: 'variable' },
      );
    });

    await waitFor(() => expect(result.current.loading).toBe(true));
    await act(async () => {
      resolveMutation(mockData);
      await promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockData);
    expect(onMutate).toHaveBeenCalledWith({ test: 'variable' });
    expect(mutationFn).toHaveBeenCalledWith({ test: 'variable' });
    expect(onSuccess).toHaveBeenCalledWith(mockData, { test: 'variable' }, { snapshot: 'test' });
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(mockData, null, { test: 'variable' }, { snapshot: 'test' });
  });

  it('should handle mutation error', async () => {
    const mockError = new Error('Test error');
    (require('../../api/client').postJSON as jest.Mock).mockRejectedValue(mockError);
    
    const mutationFn = jest.fn().mockRejectedValue(mockError);
    const onMutate = jest.fn().mockResolvedValue({ snapshot: 'test' });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onSettled = jest.fn();
    
    const { result } = renderHook(() => 
      useOptimisticMutation()
    );
    
    await act(async () => {
      try {
        await result.current.mutate(
          {
            mutationFn,
            onMutate,
            onSuccess,
            onError,
            onSettled,
          },
          { test: 'variable' }
        );
      } catch (e) {
        // Expected error
      }
    });
    
    // Check loading state
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(mockError);
    expect(onMutate).toHaveBeenCalledWith({ test: 'variable' });
    expect(mutationFn).toHaveBeenCalledWith({ test: 'variable' });
    expect(onError).toHaveBeenCalledWith(mockError, { test: 'variable' }, { snapshot: 'test' });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });

  it('rejects concurrent mutations instead of silently queueing or retrying writes', async () => {
    let resolveMutation!: () => void;
    const mutationFn = jest.fn(() => new Promise<void>(resolve => {
      resolveMutation = resolve;
    }));
    const { result } = renderHook(() => useOptimisticMutation());

    let firstPromise!: Promise<void | undefined>;
    act(() => {
      firstPromise = result.current.mutate({ mutationFn }, { test: 'first' }) as Promise<void | undefined>;
    });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      await expect(result.current.mutate({ mutationFn }, { test: 'second' })).rejects.toThrow(
        'A save is already in progress',
      );
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMutation();
      await firstPromise;
    });
    expect(result.current.loading).toBe(false);
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});