import { getDistance } from 'geolib';

/**
 * Calculate distance between two coordinates and check if within geofence
 * @param {Object} staffCoords - { latitude, longitude }
 * @param {Object} officeCoords - { latitude, longitude }
 * @param {number} radiusMeters - Geofence radius in meters
 * @returns {{ distance: number, withinGeofence: boolean }}
 */
export const checkGeofence = (staffCoords, officeCoords, radiusMeters) => {
  const distance = getDistance(
    { latitude: staffCoords.latitude, longitude: staffCoords.longitude },
    { latitude: officeCoords.latitude, longitude: officeCoords.longitude }
  );
  return {
    distance,
    withinGeofence: distance <= radiusMeters,
  };
};
