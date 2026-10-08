import {
  requestLocationPermissions,
  getCurrentLocation,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../src/services/location/locationService';
import * as Location from 'expo-location';

describe('Location & Tracking Service', () => {
  it('requests foreground and background location permissions', async () => {
    const granted = await requestLocationPermissions();
    expect(granted).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it('retrieves current coordinates and battery info', async () => {
    const location = await getCurrentLocation();
    expect(location).not.toBeNull();
    if (location) {
      expect(location.latitude).toBe(28.6139);
      expect(location.longitude).toBe(77.2090);
      expect(location.batteryLevel).toBe(85);
    }
  });

  it('starts background tracking with correct interval settings', async () => {
    await startBackgroundTracking();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalled();
  });

  it('stops background tracking cleanly', async () => {
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValueOnce(true);
    await stopBackgroundTracking();
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
  });
});
