import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let currentRecording: Audio.Recording | null = null;
let recordingStartTime: number | null = null;

/**
 * Request microphone permissions for emergency audio capture.
 */
export async function requestAudioPermissions(): Promise<boolean> {
  try {
    const { status, granted } = await Audio.requestPermissionsAsync();
    return granted || status === 'granted';
  } catch (err) {
    console.warn('[Audio] Permission request failed:', err);
    return false;
  }
}

/**
 * Check if microphone permission is already granted.
 */
export async function hasAudioPermission(): Promise<boolean> {
  try {
    const { status, granted } = await Audio.getPermissionsAsync();
    return granted || status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Starts ambient emergency audio recording in low-bandwidth mode (~32kbps AAC/m4a).
 * Keeps audio files small (< 100 KB) for rapid upload even on slow 3G/4G connections.
 */
export async function startEmergencyRecording(): Promise<boolean> {
  try {
    // If already recording, stop the previous one first
    if (currentRecording) {
      await stopEmergencyRecording();
    }

    const permitted = await requestAudioPermissions();
    if (!permitted) {
      console.warn('[Audio] Microphone permission denied');
      return false;
    }

    // Configure audio mode for background recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
    await recording.startAsync();

    currentRecording = recording;
    recordingStartTime = Date.now();
    console.log('[Audio] Emergency recording started successfully');
    return true;
  } catch (err) {
    console.error('[Audio] Failed to start recording:', err);
    currentRecording = null;
    recordingStartTime = null;
    return false;
  }
}

/**
 * Stops emergency audio recording and returns the local file URI.
 */
export async function stopEmergencyRecording(): Promise<string | null> {
  if (!currentRecording) {
    return null;
  }

  try {
    const status = await currentRecording.getStatusAsync();
    if (status.isRecording || !status.isDoneRecording) {
      await currentRecording.stopAndUnloadAsync();
    }
    const uri = currentRecording.getURI();
    console.log('[Audio] Emergency recording saved at:', uri);
    currentRecording = null;
    recordingStartTime = null;
    return uri;
  } catch (err) {
    console.error('[Audio] Failed to stop recording:', err);
    currentRecording = null;
    recordingStartTime = null;
    return null;
  }
}

/**
 * Returns true if an audio recording is currently active.
 */
export function isAudioRecording(): boolean {
  return currentRecording !== null;
}

/**
 * Returns the duration in seconds of the current recording.
 */
export function getRecordingDuration(): number {
  if (!recordingStartTime) return 0;
  return Math.floor((Date.now() - recordingStartTime) / 1000);
}

/**
 * Uploads emergency audio to free cloud hosting (tmpfiles.org)
 * and returns the direct playable streaming link.
 * 
 * Free endpoint: https://tmpfiles.org/api/v1/upload
 * Converts: https://tmpfiles.org/12345/audio.m4a -> https://tmpfiles.org/dl/12345/audio.m4a
 */
export async function uploadEmergencyAudio(localUri: string): Promise<string | null> {
  if (!localUri) return null;

  let timeoutId: NodeJS.Timeout | null = null;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const filename = localUri.split('/').pop() || `emergency_${Date.now()}.m4a`;

    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: filename,
      type: 'audio/m4a',
    } as any);

    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[Audio Upload] Server responded with status: ${response.status}`);
      return null;
    }

    const json = await response.json();
    if (json?.status === 'success' && json?.data?.url) {
      const rawUrl: string = json.data.url;
      // Convert web view URL to direct streaming/download URL:
      // https://tmpfiles.org/12345/file.m4a -> https://tmpfiles.org/dl/12345/file.m4a
      const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      console.log('[Audio Upload] Direct playback URL generated:', directUrl);
      return directUrl;
    }

    return null;
  } catch (err) {
    console.warn('[Audio Upload] Upload failed or timed out:', err);
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

