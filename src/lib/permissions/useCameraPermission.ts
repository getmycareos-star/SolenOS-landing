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
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setState({ status: 'unsupported' });
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const requestCamera = useCallback(async () => {
    if (!checkAvailability()) {
      return;
    }

    setState({ status: 'unknown' }); // Reset to unknown while requesting

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setState({ status: 'granted', stream });
    } catch (err: any) {
      let message = 'Unknown error';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Permission denied';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is already in use';
      } else {
        message = err.message;
      }
      setState({ status: 'error', message });
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