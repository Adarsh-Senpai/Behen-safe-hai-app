// ─── Emergency Contact ────────────────────────────────────────────────────────
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

// ─── Location Payload ─────────────────────────────────────────────────────────
export interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  batteryLevel?: number;
}

// ─── SOS State ───────────────────────────────────────────────────────────────
export type SOSStatus = 'idle' | 'countdown' | 'active' | 'cancelled';

// ─── Navigation Param List ───────────────────────────────────────────────────
export type RootStackParamList = {
  Dashboard: undefined;
  SosCountdown: { autoTrigger?: boolean };
  EmergencyContacts: undefined;
  TrackingActive: undefined;
};
