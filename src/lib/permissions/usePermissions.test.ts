import { renderHook, act } from '@testing-library/react';
import { useLocationPermission } from './useLocationPermission';
import { useCameraPermission } from './useCameraPermission';

// Mock the global navigator object
const mockGeolocation = {
  getCurrentPosition: jest.fn()
};

const mockMediaDevices = {
  getUserMedia: jest.fn()
};

describe('useLocationPermission', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockGeolocation.getCurrentPosition.mockReset();
    mockMediaDevices.getUserMedia.mockReset();
    
    // Restore the original navigator after each test
    delete navigator.geolocation;
    delete navigator.mediaDevices;
  });

  it('should return unknown state initially', () => {
    const { result } = renderHook(() => useLocationPermission());
    expect(result.current.state.status).toBe('unknown');
  });

  it('should handle geolocation not being supported', () => {
    // Mock navigator without geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true
    });

    const { result } = renderHook(() => useLocationPermission());
    expect(result.current.state.status).toBe('unsupported');
  });

  it('should handle successful location request', () => {
    // Mock geolocation support
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true
    });

    const mockPosition = {
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: Date.now()
      }
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });

    const { result } = renderHook(() => useLocationPermission());
    
    // Request location
    act(() => {
      result.current.requestLocation();
    });

    // Wait for the promise to resolve
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(result.current.state.status).toBe('granted');
        expect(result.current.state.latitude).toBe(40.7128);
        expect(result.current.state.longitude).toBe(-74.0060);
        expect(result.current.state.accuracy).toBe(10);
        resolve();
      }, 100);
    });
  });

  it('should handle location permission denied', () => {
    // Mock geolocation support
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true
    });

    mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
      error({ code: 1, message: 'Permission denied' }); // Permission denied
    });

    const { result } = renderHook(() => useLocationPermission());
    
    // Request location
    act(() => {
      result.current.requestLocation();
    });

    // Wait for the promise to resolve
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(result.current.state.status).toBe('error');
        expect(result.current.state.message).toBe('Permission denied');
        resolve();
      }, 100);
    });
  });
});

describe('useCameraPermission', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockMediaDevices.getUserMedia.mockReset();
    
    // Restore the original navigator after each test
    delete navigator.mediaDevices;
  });

  it('should return unknown state initially', () => {
    const { result } = renderHook(() => useCameraPermission());
    expect(result.current.state.status).toBe('unknown');
  });

  it('should handle camera not being supported', () => {
    // Mock navigator without mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true
    });

    const { result } = renderHook(() => useCameraPermission());
    expect(result.current.state.status).toBe('unsupported');
  });

  it('should handle successful camera request', () => {
    // Mock mediaDevices support
    const mockStream = new MediaStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true
    });

    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

    const { result } = renderHook(() => useCameraPermission());
    
    // Request camera
    act(() => {
      result.current.requestCamera();
    });

    // Wait for the promise to resolve
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(result.current.state.status).toBe('granted');
        expect(result.current.state.stream).toBe(mockStream);
        resolve();
      }, 100);
    });
  });

  it('should handle camera permission denied', () => {
    // Mock mediaDevices support
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true
    });

    mockMediaDevices.getUserMedia.mockRejectedValue({ 
      name: 'NotAllowedError', 
      message: 'Permission denied' 
    });

    const { result } = renderHook(() => useCameraPermission());
    
    // Request camera
    act(() => {
      result.current.requestCamera();
    });

    // Wait for the promise to resolve
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(result.current.state.status).toBe('error');
        expect(result.current.state.message).toBe('Permission denied');
        resolve();
      }, 100);
    });
  });

  it('should clean up media stream on unmount', () => {
    // Mock mediaDevices support
    const mockStream = new MediaStream();
    const getTracksMock = jest.fn().mockReturnValue([{ stop: jest.fn() }]);
    mockStream.getTracks = getTracksMock;
    
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true
    });

    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

    const { result, unmount } = renderHook(() => useCameraPermission());
    
    // Request camera
    act(() => {
      result.current.requestCamera();
    });

    // Wait for the promise to resolve
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(result.current.state.status).toBe('granted');
        
        // Unmount the hook
        unmount();
        
        // Verify that tracks were stopped
        expect(getTracksMock).toHaveBeenCalled();
        resolve();
      }, 100);
    });
  });
});