import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';

let currentRecorder: AudioRecorder | null = null;
let recordingStartTime: number | null = null;

/**
 * Request microphone permissions for emergency audio capture using expo-audio.
 */
export async function requestAudioPermissions(): Promise<boolean> {
  try {
    if (typeof requestRecordingPermissionsAsync === 'function') {
      const res = await requestRecordingPermissionsAsync();
      return res.granted || res.status === 'granted';
    }
    if (AudioModule && typeof AudioModule.requestRecordingPermissionsAsync === 'function') {
      const res = await AudioModule.requestRecordingPermissionsAsync();
      return res.granted || res.status === 'granted';
    }
    return false;
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
    if (typeof getRecordingPermissionsAsync === 'function') {
      const res = await getRecordingPermissionsAsync();
      return res.granted || res.status === 'granted';
    }
    if (AudioModule && typeof AudioModule.getRecordingPermissionsAsync === 'function') {
      const res = await AudioModule.getRecordingPermissionsAsync();
      return res.granted || res.status === 'granted';
    }
    return false;
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
    if (currentRecorder) {
      await stopEmergencyRecording();
    }

    const permitted = await requestAudioPermissions();
    if (!permitted) {
      console.warn('[Audio] Microphone permission denied');
      return false;
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    } catch (modeErr) {
      console.warn('[Audio] setAudioModeAsync warning:', modeErr);
    }

    if (!AudioModule || !AudioModule.AudioRecorder) {
      console.warn('[Audio] AudioRecorder module not available on this platform');
      return false;
    }

    const recorder = new AudioModule.AudioRecorder(RecordingPresets.LOW_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();

    currentRecorder = recorder;
    recordingStartTime = Date.now();
    console.log('[Audio] Emergency recording started successfully');
    return true;
  } catch (err) {
    console.error('[Audio] Failed to start recording:', err);
    currentRecorder = null;
    recordingStartTime = null;
    return false;
  }
}

/**
 * Stops emergency audio recording and returns the local file URI.
 */
export async function stopEmergencyRecording(): Promise<string | null> {
  if (!currentRecorder) {
    return null;
  }

  try {
    await currentRecorder.stop();
    const uri = currentRecorder.uri;
    console.log('[Audio] Emergency recording saved at:', uri);
    currentRecorder = null;
    recordingStartTime = null;
    return uri;
  } catch (err) {
    console.error('[Audio] Failed to stop recording:', err);
    currentRecorder = null;
    recordingStartTime = null;
    return null;
  }
}

/**
 * Returns true if an audio recording is currently active.
 */
export function isAudioRecording(): boolean {
  return currentRecorder !== null;
}

/**
 * Returns the duration in seconds of the current recording.
 */
export function getRecordingDuration(): number {
  if (!recordingStartTime) return 0;
  return Math.floor((Date.now() - recordingStartTime) / 1000);
}


/**
 * Uploads emergency audio to free cloud hosting and returns the direct playable streaming link.
 * Primary host: tmpfiles.org (with direct /dl/ link conversion)
 * Fallback host: uguu.se (direct audio streaming link)
 */
export async function uploadEmergencyAudio(localUri: string): Promise<string | null> {
  if (!localUri) return null;

  // Normalize URI for React Native Android / iOS FormData
  const uploadUri = localUri.startsWith('file://') ? localUri : `file://${localUri}`;
  const filename = uploadUri.split('/').pop() || `emergency_${Date.now()}.m4a`;

  let timeoutId: NodeJS.Timeout | null = null;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    // 1. Try Primary Host: tmpfiles.org
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uploadUri,
        name: filename,
        type: 'audio/m4a',
      } as any);

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.status === 'success' && json?.data?.url) {
          const rawUrl: string = json.data.url;
          const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          console.log('[Audio Upload] Direct playback URL generated (tmpfiles):', directUrl);
          return directUrl;
        }
      }
    } catch (primaryErr) {
      console.warn('[Audio Upload] Primary host tmpfiles.org failed, trying fallback uguu.se:', primaryErr);
    }

    // 2. Try Fallback Host: uguu.se
    try {
      const fallbackFormData = new FormData();
      fallbackFormData.append('files[]', {
        uri: uploadUri,
        name: filename,
        type: 'audio/m4a',
      } as any);

      const fallbackResp = await fetch('https://uguu.se/upload', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: fallbackFormData,
        signal: controller.signal,
      });

      if (fallbackResp.ok) {
        const json = await fallbackResp.json();
        if (json?.success && json?.files && json.files[0]?.url) {
          const directUrl = json.files[0].url;
          console.log('[Audio Upload] Direct playback URL generated (uguu):', directUrl);
          return directUrl;
        }
      }
    } catch (fallbackErr) {
      console.warn('[Audio Upload] Fallback host uguu.se also failed:', fallbackErr);
    }

    return null;
  } catch (err) {
    console.warn('[Audio Upload] Upload process error:', err);
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}


