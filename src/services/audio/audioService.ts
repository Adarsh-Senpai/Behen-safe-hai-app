import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

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
 * Helper to run a promise with a timeout in milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Uploads emergency audio to Supabase Storage and returns the direct playable streaming link.
 * Uses native FileSystem.uploadAsync with BINARY_CONTENT to bypass React Native JS FormData issues.
 */
export async function uploadEmergencyAudio(localUri: string): Promise<string | null> {
  if (!localUri) return null;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Audio Upload] Missing Supabase URL or Anon Key. Cannot upload audio.');
    return null;
  }

  // Normalize URI for native FileSystem upload
  const uploadUri = localUri.startsWith('file://') ? localUri : `file://${localUri}`;
  const fileName = `emergency_${Date.now()}.m4a`;
  const bucketName = 'emergency-audio';
  
  // Supabase Storage REST endpoint for file upload
  const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;

  try {
    console.log('[Audio Upload] Attempting upload to Supabase Storage...');
    const uploadTask = FileSystem.uploadAsync(uploadEndpoint, uploadUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'audio/m4a',
      },
    });

    const response = await withTimeout(uploadTask, 15000);

    if (response.status >= 200 && response.status < 300) {
      console.log('[Audio Upload] Successfully uploaded to Supabase Storage.');
      // Construct the public URL for the uploaded file
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
      console.log('[Audio Upload] Direct playable URL generated (Supabase):', publicUrl);
      return publicUrl;
    }
    
    console.warn('[Audio Upload] Supabase upload returned non-200 status:', response.status, response.body);
  } catch (err) {
    console.warn('[Audio Upload] Supabase upload failed:', err);
  }

  return null;
}


