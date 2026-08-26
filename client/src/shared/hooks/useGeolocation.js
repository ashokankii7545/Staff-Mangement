import { useState, useCallback } from 'react';

export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = 'Geolocation is not supported by your browser';
        setError(err);
        reject(err);
        return;
      }

      setLoading(true);
      setError(null);

      // Use watchPosition for better accuracy (waits for GPS lock)
      let bestPosition = null;
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const loc = { latitude, longitude, accuracy };
          
          if (!bestPosition || accuracy < bestPosition.accuracy) {
            bestPosition = loc;
          }
          
          // Accept when accuracy is good enough (500m for desktop, mobile usually < 50m)
          if (accuracy < 500) {
            navigator.geolocation.clearWatch(watchId);
            setLocation(bestPosition);
            setLoading(false);
            resolve(bestPosition);
          }
        },
        (err) => {
          navigator.geolocation.clearWatch(watchId);
          setError(err.message);
          setLoading(false);
          // If we have a best position (even if not great accuracy), use it
          if (bestPosition) {
            setLocation(bestPosition);
            resolve(bestPosition);
          } else {
            reject(err.message);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );

      // Timeout: use best position found so far
      setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        if (bestPosition) {
          setLocation(bestPosition);
          setLoading(false);
          resolve(bestPosition);
        }
      }, 12000);
    });
  }, []);

  return { location, error, loading, requestLocation };
};

