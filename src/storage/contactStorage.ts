import * as SecureStore from 'expo-secure-store';
import { EmergencyContact } from '../types';

const CONTACTS_KEY = 'safeher_emergency_contacts';

// In-memory session cache
let memoryCache: EmergencyContact[] = [];

/**
 * Persist emergency contacts securely to device storage (offline-first).
 * Uses Expo SecureStore (encrypted on-device storage) with in-memory caching.
 */
export async function saveContacts(contacts: EmergencyContact[]): Promise<void> {
  memoryCache = [...contacts];
  const serialized = JSON.stringify(contacts);

  try {
    if (SecureStore?.setItemAsync) {
      await SecureStore.setItemAsync(CONTACTS_KEY, serialized);
      return;
    }
  } catch (err) {
    // Non-fatal warning, fallback maintained in memory
    console.warn('[Storage] SecureStore write fallback:', err);
  }
}

/**
 * Retrieve emergency contacts from device storage.
 * Returns empty array if none saved yet.
 */
export async function loadContacts(): Promise<EmergencyContact[]> {
  try {
    if (SecureStore?.getItemAsync) {
      const raw = await SecureStore.getItemAsync(CONTACTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EmergencyContact[];
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Storage] SecureStore read fallback:', err);
  }

  return memoryCache;
}

/**
 * Clear all stored contacts.
 */
export async function clearContacts(): Promise<void> {
  memoryCache = [];
  try {
    if (SecureStore?.deleteItemAsync) {
      await SecureStore.deleteItemAsync(CONTACTS_KEY);
    }
  } catch (err) {
    console.warn('[Storage] SecureStore clear error:', err);
  }
}
