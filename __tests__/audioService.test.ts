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
    it('uploads audio via native FileSystem directly to uguu.se and returns playable stream URL', async () => {
      (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({
          success: true,
          files: [{ url: 'https://h.uguu.se/tceXtymK.m4a' }],
        }),
      });

      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBe('https://h.uguu.se/tceXtymK.m4a');
      expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
        'https://uguu.se/upload',
        'file:///test.m4a',
        expect.objectContaining({
          httpMethod: 'POST',
          fieldName: 'files[]',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        }),
      );
    });

    it('retries upload if first attempt fails and succeeds on retry', async () => {
      (FileSystem.uploadAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('Transient network glitch'))
        .mockResolvedValueOnce({
          status: 200,
          body: JSON.stringify({
            success: true,
            files: [{ url: 'https://d.uguu.se/retry_success.m4a' }],
          }),
        });

      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBe('https://d.uguu.se/retry_success.m4a');
      expect(FileSystem.uploadAsync).toHaveBeenCalledTimes(2);
    });

    it('returns null gracefully on upload error or network failure across all attempts', async () => {
      (FileSystem.uploadAsync as jest.Mock).mockRejectedValue(new Error('Network offline'));
      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBeNull();
    });

    it('returns null if server responds with non-ok status', async () => {
      (FileSystem.uploadAsync as jest.Mock).mockResolvedValue({
        status: 500,
        body: 'Internal Server Error',
      });
      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBeNull();
    });
  });
});
