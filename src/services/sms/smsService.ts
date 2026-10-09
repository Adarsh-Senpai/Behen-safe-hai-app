import * as SMS from 'expo-sms';
import { Linking, Platform, PermissionsAndroid } from 'react-native';
import { EmergencyContact, LocationPayload } from '../../types';
import { buildEmergencyMessage } from '../location/locationService';

// ─── Direct Background SMS Native Module (Android Standalone / EAS Build) ───
let directSmsSender: { sendSms: (phone: string, text: string) => Promise<void> } | null = null;
try {
  const mod = require('expo-android-sms-sender');
  if (mod && typeof mod.sendSms === 'function') {
    directSmsSender = mod;
  } else if (mod && mod.default && typeof mod.default.sendSms === 'function') {
    directSmsSender = mod.default;
  }
} catch {
  // Graceful fallback when running in Expo Go or iOS
  directSmsSender = null;
}

export interface DispatchResult {
  success: boolean;
  method: 'direct_background' | 'composer_bulk' | 'composer_uri';
  failedContacts: string[];
}

/**
 * Checks whether the current runtime environment supports direct background SMS sending.
 */
export function hasDirectSmsCapability(): boolean {
  return Platform.OS === 'android' && directSmsSender !== null;
}

/**
 * Explicitly requests Android SEND_SMS permission for direct background dispatch.
 */
export async function requestSendSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
    );
    if (hasPermission) return true;

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'Emergency Direct SMS Permission',
        message:
          'BehenSafeHai? needs permission to send emergency SOS alerts directly in the background to your 3 contacts without requiring manual confirmation clicks.',
        buttonPositive: 'Allow Direct SMS',
        buttonNegative: 'Ask Later',
      },
    );
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('[SMS] Direct SMS permission check failed:', err);
    return false;
  }
}

/**
 * Internal helper to dispatch any text message to emergency contacts using
 * direct background SMS -> bulk SMS composer -> individual SMS URI scheme fallback.
 */
export async function dispatchTextMessage(
  contacts: EmergencyContact[],
  message: string,
): Promise<DispatchResult> {
  const failedContacts: string[] = [];

  // 1. Direct Background SMS (Android with direct SMS module & permission)
  if (Platform.OS === 'android' && directSmsSender) {
    try {
      const hasPermission = await requestSendSmsPermission();
      if (hasPermission) {
        for (const contact of contacts) {
          try {
            await directSmsSender.sendSms(contact.phone, message);
            console.log(`[SMS] Direct background SMS sent to ${contact.name} (${contact.phone})`);
          } catch (sendErr) {
            console.warn(`[SMS] Direct send failed for ${contact.name}:`, sendErr);
            failedContacts.push(contact.name);
          }
        }

        if (failedContacts.length < contacts.length) {
          return {
            success: true,
            method: 'direct_background',
            failedContacts,
          };
        }
      }
    } catch (err) {
      console.warn('[SMS] Direct background SMS route failed, using composer:', err);
    }
  }

  // 2. Bulk SMS Composer (expo-sms)
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      const phoneNumbers = contacts.map((c) => c.phone);
      const { result } = await SMS.sendSMSAsync(phoneNumbers, message);
      console.log('[SMS] Composer bulk send result:', result);
      if (result === 'sent' || result === 'unknown') {
        return {
          success: true,
          method: 'composer_bulk',
          failedContacts: [],
        };
      }
    }
  } catch (err) {
    console.warn('[SMS] expo-sms failed, falling back to Linking:', err);
  }

  // 3. Fallback: Open individual contact SMS composers
  for (const contact of contacts) {
    try {
      const encodedMsg = encodeURIComponent(message);
      const smsUri =
        Platform.OS === 'ios'
          ? `sms:${contact.phone}&body=${encodedMsg}`
          : `sms:${contact.phone}?body=${encodedMsg}`;

      const canOpen = await Linking.canOpenURL(smsUri);
      if (canOpen) {
        await Linking.openURL(smsUri);
      } else {
        failedContacts.push(contact.name);
      }
    } catch (err) {
      failedContacts.push(contact.name);
      console.error(`[SMS] Failed for contact ${contact.name}:`, err);
    }
  }

  return {
    success: failedContacts.length < contacts.length,
    method: 'composer_uri',
    failedContacts,
  };
}

/**
 * Dispatches emergency SOS alerts with GPS location coordinates.
 */
export async function dispatchSOS(
  contacts: EmergencyContact[],
  location: LocationPayload,
): Promise<DispatchResult> {
  const message = buildEmergencyMessage(location);
  return dispatchTextMessage(contacts, message);
}

/**
 * Builds emergency audio alert SMS message containing direct playback link.
 */
export function buildAudioAlertMessage(audioUrl: string): string {
  return `EMERGENCY AUDIO RECORDING\nBehenSafeHai? ambient voice clip captured during SOS.\nListen immediately: ${audioUrl}`;
}

/**
 * Dispatches follow-up emergency audio recording link to contacts.
 */
export async function dispatchAudioAlert(
  contacts: EmergencyContact[],
  audioUrl: string,
): Promise<DispatchResult> {
  const message = buildAudioAlertMessage(audioUrl);
  return dispatchTextMessage(contacts, message);
}


// ─── Validate phone number ────────────────────────────────────────────────────
export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  const internationalRegex = /^\+?[1-9]\d{6,14}$/;
  return internationalRegex.test(cleaned);
}

// ─── Normalize phone number ───────────────────────────────────────────────────
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}
