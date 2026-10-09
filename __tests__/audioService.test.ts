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
    it('uploads audio via native FileSystem and converts tmpfiles URL to direct stream /dl/ link', async () => {
      (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({
          status: 'success',
          data: {
            url: 'https://tmpfiles.org/837261/emergency_audio.m4a',
          },
        }),
      });

      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBe('https://tmpfiles.org/dl/837261/emergency_audio.m4a');
      expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
        'https://tmpfiles.org/api/v1/upload',
        'file:///test.m4a',
        expect.objectContaining({
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        }),
      );
    });

    it('falls back to secondary host uguu.se if primary host fails', async () => {
      (FileSystem.uploadAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('tmpfiles connection failed'))
        .mockResolvedValueOnce({
          status: 200,
          body: JSON.stringify({
            success: true,
            files: [{ url: 'https://a.uguu.se/test.m4a' }],
          }),
        });

      const directUrl = await uploadEmergencyAudio('file:///test.m4a');
      expect(directUrl).toBe('https://a.uguu.se/test.m4a');
      expect(FileSystem.uploadAsync).toHaveBeenCalledTimes(2);
    });

    it('returns null gracefully on upload error or network failure across all hosts', async () => {
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
