import {
  requestAudioPermissions,
  hasAudioPermission,
  startEmergencyRecording,
  stopEmergencyRecording,
  isAudioRecording,
  uploadEmergencyAudio,
} from '../src/services/audio/audioService';
import * as FileSystem from 'expo-file-system/legacy';

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
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...ORIGINAL_ENV };
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    });

    afterAll(() => {
      process.env = ORIGINAL_ENV;
    });

    it('returns null if Supabase environment variables are missing', async () => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBeNull();
      expect(FileSystem.uploadAsync).not.toHaveBeenCalled();
    });

    it('uploads audio via native FileSystem directly to Supabase REST API and returns public URL', async () => {
      // Mock Date.now to ensure predictable URL in assertion
      const mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1234567890);

      (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({
        status: 200,
        body: '', // Supabase might return an empty body or JSON for storage upload
      });

      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBe('https://test-project.supabase.co/storage/v1/object/public/emergency-audio/emergency_1234567890.m4a');
      expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
        'https://test-project.supabase.co/storage/v1/object/emergency-audio/emergency_1234567890.m4a',
        'file:///test.m4a',
        expect.objectContaining({
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: 'Bearer test-anon-key',
            apikey: 'test-anon-key',
            'Content-Type': 'audio/m4a',
          },
        }),
      );

      mockDateNow.mockRestore();
    });

    it('returns null gracefully on upload error or network failure', async () => {
      (FileSystem.uploadAsync as jest.Mock).mockRejectedValue(new Error('Network offline'));
      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBeNull();
    });

    it('returns null if Supabase server responds with non-ok status', async () => {
      (FileSystem.uploadAsync as jest.Mock).mockResolvedValue({
        status: 403,
        body: '{"statusCode":"403","error":"Forbidden","message":"Bucket not found or not public"}',
      });
      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBeNull();
    });
  });
});
