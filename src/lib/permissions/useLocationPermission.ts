import { useState, useCallback } from 'react';

export type LocationPermissionState =
  | { status: 'unknown' }
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'granted'; latitude: number; longitude: number; accuracy: number; timestamp: number }
  | { status: 'error'; message: string };

export const useLocationPermission = () => {
  const [state, setState] = useState<LocationPermissionState>({ status: 'unknown' });

  const checkAvailability = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported' });
      return false;
    }
    return true;
  }, []);

  const requestLocation = useCallback(async () => {
    if (!checkAvailability()) {
      return;
    }

    setState({ status: 'unknown' }); // Reset to unknown while requesting

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 60000,
          enableHighAccuracy: true,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;
      const { timestamp } = position;
      setState({
        status: 'granted',
        latitude,
        longitude,
        accuracy,
        timestamp,
      });
    } catch (err: any) {
      let message = 'Unknown error';
      if (err.code === 1) {
        message = 'Permission denied';
      } else if (err.code === 2) {
        message = 'Position unavailable';
      } else if (err.code === 3) {
        message = 'Timeout';
      } else {
        message = err.message;
      }
      setState({ status: 'error', message });
    }
  }, [checkAvailability]);

  return { state, requestLocation };
};