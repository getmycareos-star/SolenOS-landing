import { renderHook, act } from '@testing-library/react';
import { useOptimisticMutation } from './optimistic';

// Mock the API client functions
jest.mock('../api/client', () => ({
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
    (require('../api/client').postJSON as jest.Mock).mockResolvedValue(mockData);
    
    const mutationFn = jest.fn().mockResolvedValue(mockData);
    const onMutate = jest.fn().mockResolvedValue({ snapshot: 'test' });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onSettled = jest.fn();
    
    const { result } = renderHook(() => 
      useOptimisticMutation()
    );
    
    await act(async () => {
      result.current.mutate(
        {
          mutationFn,
          onMutate,
          onSuccess,
          onError,
          onSettled,
        },
        { test: 'variable' }
      );
    });
    
    // Check loading state
    expect(result.current.loading).toBe(true);
    
    // Wait for mutation to complete
    await act(async () => {
      // Wait a bit for the async operations
      return new Promise(resolve => setTimeout(resolve, 10));
    });
    
    // Check that loading is finished
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockData);
    expect(onMutate).toHaveBeenCalledWith({ test: 'variable' });
    expect(mutationFn).toHaveBeenCalledWith({ test: 'variable' });
    expect(onSuccess).toHaveBeenCalledWith(mockData, { test: 'variable' }, { snapshot: 'test' });
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });

  it('should handle mutation error', async () => {
    const mockError = new Error('Test error');
    (require('../api/client').postJSON as jest.Mock).mockRejectedValue(mockError);
    
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

  it('should prevent concurrent mutations', async () => {
    const mutationFn = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    const onMutate = jest.fn().mockResolvedValue({});
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onSettled = jest.fn();
    
    const { result } = renderHook(() => 
      useOptimisticMutation()
    );
    
    // Start first mutation
    let firstPromise: Promise<void>;
    act(() => {
      firstPromise = result.current.mutate(
        {
          mutationFn,
          onMutate,
          onSuccess,
          onError,
          onSettled,
        },
        { test: 'variable1' }
      ) as Promise<void>;
    });
    
    // Try to start second mutation while first is pending
    let secondPromise: Promise<void>;
    act(() => {
      secondPromise = result.current.mutate(
        {
          mutationFn,
          onMutate,
          onSuccess,
          onError,
          onSettled,
          retry: true, // Enable retry to test waiting behavior
        },
        { test: 'variable2' }
      ) as Promise<void>;
    });
    
    // First mutation should still be pending
    expect(result.current.loading).toBe(true);
    
    // Wait for first mutation to complete
    await act(async () => {
      await firstPromise;
    });
    
    // Second mutation should have started after first completed
    expect(result.current.loading).toBe(true);
    
    // Wait for second mutation to complete
    await act(async () => {
      await secondPromise;
    });
    
    // Both mutations should have completed
    expect(result.current.loading).toBe(false);
    expect(mutationFn).toHaveBeenCalledTimes(2);
  });
});