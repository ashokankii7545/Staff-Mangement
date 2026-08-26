import { getDistance } from 'geolib';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeofenceResult {
  distance: number;
  withinGeofence: boolean;
}

/** Haversine distance + inside/outside verdict for a site geofence. */
export const checkGeofence = (
  staffCoords: GeoPoint,
  officeCoords: GeoPoint,
  radiusMeters: number,
): GeofenceResult => {
  const distance = getDistance(
    { latitude: staffCoords.latitude, longitude: staffCoords.longitude },
    { latitude: officeCoords.latitude, longitude: officeCoords.longitude },
  );
  return { distance, withinGeofence: distance <= radiusMeters };
};
