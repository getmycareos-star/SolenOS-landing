import { useState, useCallback, useRef, useEffect } from 'react';

export type CameraPermissionState =
  | { status: 'unknown' }
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'granted'; stream: MediaStream }
  | { status: 'error'; message: string };

export const useCameraPermission = () => {
  const [state, setState] = useState<CameraPermissionState>({ status: 'unknown' });
  const streamRef = useRef<MediaStream | null>(null);

  const checkAvailability = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState({ status: 'unsupported' });
      return false;
    }
    return true;
  }, []);

  const requestCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!checkAvailability()) {
      return null;
    }

    setState({ status: 'unknown' }); // Reset to unknown while requesting

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setState({ status: 'granted', stream });
      return stream;
      return stream;
    } catch (err: unknown) {
      const cameraError = err instanceof Error ? err : new Error(String(err));
      const errorName =
        typeof err === 'object' && err !== null && 'name' in err
          ? String((err as { name?: unknown }).name)
          : '';

      let message = cameraError.message || 'Unknown error';
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        message = 'Permission denied';
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        message = 'No camera found';
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        message = 'Camera is already in use';
      }
      setState({ status: 'error', message });
      return null;
    }
  }, [checkAvailability]);

  // Cleanup on unmount or when stopping
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setState({ status: 'unknown' });
    }
  }, []);

  return { state, requestCamera, stopCamera };
};