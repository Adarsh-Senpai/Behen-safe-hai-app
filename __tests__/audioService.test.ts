import {
  requestAudioPermissions,
  hasAudioPermission,
  startEmergencyRecording,
  stopEmergencyRecording,
  isAudioRecording,
  uploadEmergencyAudio,
} from '../src/services/audio/audioService';

describe('Audio Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Permissions', () => {
    it('requests audio recording permissions successfully', async () => {
      const permitted = await requestAudioPermissions();
      expect(permitted).toBe(true);
    });

    it('checks existing audio permissions', async () => {
      const hasPerm = await hasAudioPermission();
      expect(hasPerm).toBe(true);
    });
  });

  describe('Recording lifecycle', () => {
    it('starts emergency recording and updates recording state', async () => {
      const started = await startEmergencyRecording();
      expect(started).toBe(true);
      expect(isAudioRecording()).toBe(true);
    });

    it('stops emergency recording and returns audio URI', async () => {
      await startEmergencyRecording();
      const uri = await stopEmergencyRecording();
      expect(uri).toBe('file:///test-emergency-audio.m4a');
      expect(isAudioRecording()).toBe(false);
    });

    it('returns null if stopping when not recording', async () => {
      const uri = await stopEmergencyRecording();
      expect(uri).toBeNull();
      expect(isAudioRecording()).toBe(false);
    });
  });

  describe('Upload', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('uploads audio and converts web URL to direct stream link with /dl/', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            url: 'https://tmpfiles.org/837261/emergency_audio.m4a',
          },
        }),
      } as any);

      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBe('https://tmpfiles.org/dl/837261/emergency_audio.m4a');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tmpfiles.org/api/v1/upload',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('returns null gracefully on upload error or network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));
      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBeNull();
    });

    it('returns null if server responds with non-ok status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);
      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBeNull();
    });
  });
});
