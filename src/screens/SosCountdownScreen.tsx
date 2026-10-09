import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types';
import { useCountdown } from '../hooks/useCountdown';
import { useContacts } from '../hooks/useContacts';
import {
  getCurrentLocation,
  requestLocationPermissions,
  startBackgroundTracking,
} from '../services/location/locationService';
import { dispatchSOS, dispatchAudioAlert } from '../services/sms/smsService';
import {
  startEmergencyRecording,
  stopEmergencyRecording,
  uploadEmergencyAudio,
} from '../services/audio/audioService';

type Props = NativeStackScreenProps<RootStackParamList, 'SosCountdown'>;

const COUNTDOWN_SECONDS = 10;

export default function SosCountdownScreen({ navigation }: Props) {
  const { contacts } = useContacts();
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [dispatchMethod, setDispatchMethod] = useState<'direct_background' | 'composer_bulk' | 'composer_uri' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioRecording, setAudioRecording] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const recDotAnim = useRef(new Animated.Value(1)).current;

  // Pulsing ring animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, pulseOpacity]);

  // Audio recording indicator blinking
  useEffect(() => {
    const recBlink = Animated.loop(
      Animated.sequence([
        Animated.timing(recDotAnim, { toValue: 0.2, duration: 550, useNativeDriver: true }),
        Animated.timing(recDotAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    recBlink.start();
    return () => recBlink.stop();
  }, [recDotAnim]);

  // Start hands-free ambient audio recording immediately upon entering countdown
  useEffect(() => {
    startEmergencyRecording()
      .then((started) => {
        if (started) setAudioRecording(true);
      })
      .catch((err) => {
        console.warn('[Countdown] Auto audio recording failed to init:', err);
      });

    return () => {
      // If user navigates away before SOS dispatches, stop and cleanup
      stopEmergencyRecording().catch(() => {});
    };
  }, []);

  const triggerDispatch = useCallback(async () => {
    if (dispatching || dispatched) return;
    setDispatching(true);
    setError(null);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

    try {
      // 1. Request location permission
      const hasPermission = await requestLocationPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'BehenSafeHai? requires GPS permissions to send your location to emergency contacts. Please enable permissions in system settings.',
          [{ text: 'OK' }],
        );
      }

      // 2. Concurrently fetch location AND stop + upload the 10-second emergency audio clip
      // so the audio recording link is directly embedded inside the SMS sent to contacts
      const locationPromise = getCurrentLocation().then(
        (loc) =>
          loc || {
            latitude: 0,
            longitude: 0,
            accuracy: null,
            timestamp: Date.now(),
          },
      );

      const audioUploadPromise = (async () => {
        try {
          const audioUri = await stopEmergencyRecording();
          setAudioRecording(false);
          if (audioUri) {
            console.log('[Countdown] Uploading emergency audio recording...');
            return await uploadEmergencyAudio(audioUri);
          }
          return null;
        } catch (e) {
          console.warn('[Countdown] Audio capture/upload failed:', e);
          return null;
        }
      })();

      // 3.5-second timeout safety cap so emergency SMS is never held up if cellular data is offline
      const [location, audioUrl] = await Promise.all([
        locationPromise,
        Promise.race([
          audioUploadPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ]),
      ]);

      console.log('[Countdown] Dispatching unified SOS SMS with embedded audioUrl:', audioUrl);

      // 3. Dispatch unified SOS SMS containing GPS location AND audio link together
      const result = await dispatchSOS(contacts, location, audioUrl);
      setDispatchMethod(result.method);

      // 4. Start background tracking
      await startBackgroundTracking();


      setDispatched(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Success animation
      Animated.spring(successScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();

      // Navigate to tracking screen after 2.5 seconds
      setTimeout(() => {
        navigation.replace('TrackingActive');
      }, 2500);
    } catch (err: any) {
      console.error('[Countdown] Dispatch error:', err);
      setError(err?.message || 'Failed to dispatch SOS alerts. Please call emergency services.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setDispatching(false);
    }
  }, [contacts, dispatching, dispatched, navigation, successScale]);

  // Use countdown hook
  const { secondsLeft, progress, cancel } = useCountdown(
    COUNTDOWN_SECONDS,
    triggerDispatch,
  );

  const handleYes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    triggerDispatch();
  };

  const handleNo = () => {
    cancel();
    stopEmergencyRecording().catch(() => {});
    setAudioRecording(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate('Dashboard');
  };

  const timerColor = secondsLeft <= 3 ? '#ff1744' : secondsLeft <= 6 ? '#f59e0b' : '#ff2d55';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09080e" />

      {/* Background */}
      <View style={styles.bgGlow} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.alertBadge}>
          <View style={styles.badgePulseDot} />
          <Text style={styles.alertBadgeText}>EMERGENCY PROTOCOL</Text>
        </View>

        {audioRecording && (
          <View style={styles.audioRecBadge}>
            <Animated.View style={[styles.audioRecDot, { opacity: recDotAnim }]} />
            <Text style={styles.audioRecText}>AMBIENT AUDIO REC ACTIVE</Text>
          </View>
        )}

        <Text style={styles.headerTitle}>Dispatching Live GPS Location</Text>
        <Text style={styles.headerSub}>
          Alerting your 3 designated emergency contacts via SMS
        </Text>
      </View>


      {/* Timer Ring */}
      <View style={styles.timerSection}>
        {/* Pulsing outer ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: pulseOpacity,
              borderColor: timerColor,
            },
          ]}
        />

        {/* Circular timer frame */}
        <View style={[styles.progressRing, { borderColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={styles.timerInner}>
            {dispatching ? (
              <ActivityIndicator size="large" color="#ff2d55" />
            ) : dispatched ? (
              <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }] }]}>
                <Text style={styles.successTitle}>DISPATCHED</Text>
                <Text style={styles.successSub}>LIVE RADAR ACTIVE</Text>
              </Animated.View>
            ) : (
              <>
                <Text style={[styles.countdown, { color: timerColor }]}>{secondsLeft}</Text>
                <Text style={styles.countdownLabel}>SECONDS</Text>
              </>
            )}
          </View>
        </View>

        {/* Animated arc overlay */}
        <Animated.View
          style={[
            styles.arcOverlay,
            {
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
              borderTopColor: timerColor,
              borderLeftColor: timerColor,
              transform: [
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: ['0deg', '180deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Status Text */}
      <View style={styles.statusSection}>
        {dispatched ? (
          <Text style={styles.statusTextSuccess}>
            {dispatchMethod === 'direct_background'
              ? 'Emergency alert sent in background. Live GPS tracking active.'
              : 'Emergency alert dispatched. Live GPS tracking active.'}
          </Text>
        ) : dispatching ? (
          <Text style={styles.statusTextPending}>
            Acquiring high-accuracy GPS coordinates & dispatching SMS...
          </Text>
        ) : (
          <Text style={styles.statusTextWarning}>
            Auto-dispatching to all 3 contacts when timer reaches 0
          </Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Action Buttons */}
      {!dispatched && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btnNo, dispatching && styles.btnDisabled]}
            onPress={handleNo}
            disabled={dispatching}
            activeOpacity={0.8}
            accessibilityLabel="Cancel SOS - I am safe"
            accessibilityRole="button"
          >
            <Text style={styles.btnNoText}>I am Safe (Cancel)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnYes, dispatching && styles.btnDisabled]}
            onPress={handleYes}
            disabled={dispatching}
            activeOpacity={0.88}
            accessibilityLabel="Send SOS now"
            accessibilityRole="button"
          >
            <Text style={styles.btnYesText}>Send SOS Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contact list preview */}
      {!dispatched && contacts.length > 0 && (
        <View style={styles.contactsList}>
          <Text style={styles.contactsListTitle}>TARGET CONTACTS</Text>
          {contacts.map((c, i) => (
            <Text key={c.id} style={styles.contactsListItem}>
              0{i + 1} &bull; {c.name} ({c.relationship}) &mdash; {c.phone}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const ACCENT = '#ff2d55';
const ACCENT_RED = '#ff1744';
const DARK_BG = '#09080e';
const SURFACE = '#14121f';
const BORDER = 'rgba(255, 255, 255, 0.08)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: 'center',
  },
  bgGlow: {
    position: 'absolute',
    top: -80,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(255, 45, 85, 0.07)',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 65,
    paddingBottom: 25,
    paddingHorizontal: 25,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.35)',
    marginBottom: 16,
    gap: 8,
  },
  badgePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  alertBadgeText: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  audioRecBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.3)',
    marginBottom: 12,
    gap: 7,
  },
  audioRecDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_RED,
  },
  audioRecText: {
    color: ACCENT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  headerSub: {
    color: '#8e8a9f',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  timerSection: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
  },
  progressRing: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SURFACE,
  },
  timerInner: {
    alignItems: 'center',
  },
  countdown: {
    fontSize: 70,
    fontWeight: '900',
    lineHeight: 76,
  },
  countdownLabel: {
    color: '#8e8a9f',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  successCircle: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  successTitle: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  successSub: {
    color: '#8e8a9f',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  arcOverlay: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 6,
    borderColor: 'transparent',
  },
  statusSection: {
    paddingHorizontal: 30,
    marginBottom: 26,
    alignItems: 'center',
  },
  statusTextWarning: {
    color: '#f59e0b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  statusTextPending: {
    color: '#60a5fa',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  statusTextSuccess: {
    color: '#10b981',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 17,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  btnNo: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  btnNoText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnYes: {
    flex: 1,
    backgroundColor: ACCENT_RED,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  btnYesText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  contactsList: {
    width: '90%',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  contactsListTitle: {
    color: '#8e8a9f',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  contactsListItem: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 3,
  },
});
