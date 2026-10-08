import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { LocationPayload } from '../../types';

export const LOCATION_TASK_NAME = 'safeher-background-location';

// ─── Permission Request ───────────────────────────────────────────────────────
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return false;

    try {
      const { status: bg } = await Location.requestBackgroundPermissionsAsync();
      if (bg !== 'granted') {
        console.warn('[Location] Background permission not granted – tracking limited');
      }
    } catch (bgErr) {
      console.warn('[Location] Background permission not supported in this client:', bgErr);
    }
    return true;
  } catch (err) {
    console.error('[Location] Permission request error:', err);
    return false;
  }
}

// ─── Get Current Location ─────────────────────────────────────────────────────
export async function getCurrentLocation(): Promise<LocationPayload | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    let batteryLevel: number | undefined;
    try {
      if (Battery?.getBatteryLevelAsync) {
        const bl = await Battery.getBatteryLevelAsync();
        batteryLevel = Math.round(bl * 100);
      }
    } catch {
      // battery API may not be available on some devices/simulators
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
      batteryLevel,
    };
  } catch (err) {
    console.error('[Location] Failed to get current location:', err);
    return null;
  }
}

// ─── Build SMS Message ────────────────────────────────────────────────────────
export function buildEmergencyMessage(payload: LocationPayload): string {
  const mapsUrl = `https://maps.google.com/?q=${payload.latitude},${payload.longitude}`;
  const accuracyStr = payload.accuracy ? `${Math.round(payload.accuracy)}m` : 'unknown';
  const battStr =
    payload.batteryLevel !== undefined ? ` | Battery: ${payload.batteryLevel}%` : '';
  return (
    `🆘 EMERGENCY SOS! I need help immediately!\n\n` +
    `📍 My current location:\n${mapsUrl}\n\n` +
    `Accuracy: ${accuracyStr}${battStr}\n\n` +
    `Please contact emergency services and come to my location.\n` +
    `Sent via SafeHer Safety App`
  );
}

// ─── Background Task Definition ───────────────────────────────────────────────
try {
  if (TaskManager?.defineTask) {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
      if (error) {
        console.error('[BGLocation] Task error:', error);
        return;
      }
      if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        if (locations && locations.length > 0) {
          const loc = locations[0];
          console.log(
            `[BGLocation] Update: ${loc.coords.latitude}, ${loc.coords.longitude} @ ${new Date(
              loc.timestamp,
            ).toISOString()}`,
          );
        }
      }
    });
  }
} catch (err) {
  console.warn('[Location] Background task definition skipped:', err);
}

// ─── Start Background Tracking ────────────────────────────────────────────────
export async function startBackgroundTracking(): Promise<void> {
  try {
    if (!Location?.startLocationUpdatesAsync) {
      console.warn('[Location] startLocationUpdatesAsync not available in Expo Go');
      return;
    }
    const isTracking = await isBackgroundTrackingActive();
    if (isTracking) return;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 20000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '🔴 Emergency Tracking Active',
        notificationBody: 'SafeHer is sharing your location. Tap to open.',
        notificationColor: '#e91e8c',
      },
      pausesUpdatesAutomatically: false,
    });

    console.log('[Location] Background tracking started');
  } catch (err) {
    console.warn('[Location] Background tracking error (use development build for full background support):', err);
  }
}

// ─── Stop Background Tracking ─────────────────────────────────────────────────
export async function stopBackgroundTracking(): Promise<void> {
  try {
    if (!Location?.stopLocationUpdatesAsync) return;
    const isTracking = await isBackgroundTrackingActive();
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('[Location] Background tracking stopped');
    }
  } catch (err) {
    console.warn('[Location] Failed to stop background tracking:', err);
  }
}

// ─── Check if tracking is active ─────────────────────────────────────────────
export async function isBackgroundTrackingActive(): Promise<boolean> {
  try {
    if (!Location?.hasStartedLocationUpdatesAsync) return false;
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}
