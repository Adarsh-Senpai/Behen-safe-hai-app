import { validatePhoneNumber, normalizePhone } from '../src/services/sms/smsService';
import { buildEmergencyMessage } from '../src/services/location/locationService';
import { LocationPayload } from '../src/types';

describe('SMS & Emergency Dispatch Service', () => {
  describe('validatePhoneNumber', () => {
    it('accepts standard 10-digit Indian numbers', () => {
      expect(validatePhoneNumber('9876543210')).toBe(true);
    });

    it('accepts international numbers with + prefix', () => {
      expect(validatePhoneNumber('+14155552671')).toBe(true);
      expect(validatePhoneNumber('+919876543210')).toBe(true);
      expect(validatePhoneNumber('+447911123456')).toBe(true);
    });

    it('accepts phone numbers formatted with dashes and spaces', () => {
      expect(validatePhoneNumber('+1 (415) 555-2671')).toBe(true);
      expect(validatePhoneNumber('987-654-3210')).toBe(true);
    });

    it('rejects invalid or too short numbers', () => {
      expect(validatePhoneNumber('123')).toBe(false);
      expect(validatePhoneNumber('abc')).toBe(false);
      expect(validatePhoneNumber('')).toBe(false);
    });
  });

  describe('normalizePhone', () => {
    it('strips whitespaces, brackets and dashes', () => {
      expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
      expect(normalizePhone('987-654-3210')).toBe('9876543210');
    });
  });

  describe('buildEmergencyMessage', () => {
    it('generates a formatted zero-cost SOS SMS with Google Maps coordinates and battery', () => {
      const payload: LocationPayload = {
        latitude: 28.6139,
        longitude: 77.2090,
        accuracy: 12.4,
        timestamp: 1700000000000,
        batteryLevel: 85,
      };

      const message = buildEmergencyMessage(payload);

      expect(message).toContain('EMERGENCY SOS');
      expect(message).toContain('https://maps.google.com/?q=28.6139,77.209');
      expect(message).toContain('Accuracy: 12m');
      expect(message).toContain('Battery: 85%');
      expect(message).toContain('BehenSafeHai? Safety App');
    });

    it('handles payload without battery level gracefully', () => {
      const payload: LocationPayload = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: null,
        timestamp: 1700000000000,
      };

      const message = buildEmergencyMessage(payload);

      expect(message).toContain('https://maps.google.com/?q=37.7749,-122.4194');
      expect(message).toContain('Accuracy: unknown');
      expect(message).not.toContain('Battery:');
    });
  });

  describe('dispatchSOS', () => {
    it('dispatches to contacts and returns dispatch method and success status', async () => {
      const { dispatchSOS } = require('../src/services/sms/smsService');
      const contacts = [
        { id: '1', name: 'Alice', phone: '9876543210', relationship: 'Parent' },
        { id: '2', name: 'Bob', phone: '9876543211', relationship: 'Friend' },
      ];
      const payload: LocationPayload = {
        latitude: 28.6139,
        longitude: 77.2090,
        accuracy: 10,
        timestamp: 1700000000000,
        batteryLevel: 90,
      };

      const result = await dispatchSOS(contacts, payload);
      expect(result.success).toBe(true);
      expect(['direct_background', 'composer_bulk', 'composer_uri']).toContain(result.method);
    });
  });
});
