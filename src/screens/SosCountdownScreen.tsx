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
import { dispatchSOS } from '../services/sms/smsService';

type Props = NativeStackScreenProps<RootStackParamList, 'SosCountdown'>;

const COUNTDOWN_SECONDS = 10;

export default function SosCountdownScreen({ navigation }: Props) {
  const { contacts } = useContacts();
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [dispatchMethod, setDispatchMethod] = useState<'direct_background' | 'composer_bulk' | 'composer_uri' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // Pulsing ring animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
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

  const triggerDispatch = useCallback(async () => {
    if (dispatching || dispatched) return;
    setDispatching(true);
    setError(null);

    try {
      // Escalation haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Ensure permissions
      const hasPermission = await requestLocationPermissions();
      if (!hasPermission) {
        setError('Location permission denied. Please enable it in Settings.');
        setDispatching(false);
        return;
      }

      // Get location
      const location = await getCurrentLocation();
      if (!location) {
        setError('Unable to get your location. Please check GPS settings.');
        setDispatching(false);
        return;
      }

      // Dispatch SMS
      const contactsToAlert = contacts.length === 3 ? contacts : contacts;
      if (contactsToAlert.length === 0) {
        setError('No emergency contacts found. Please add contacts first.');
        setDispatching(false);
        return;
      }

      const result = await dispatchSOS(contactsToAlert, location);
      setDispatchMethod(result.method);

      // Start background tracking
      try {
        await startBackgroundTracking();
      } catch (trackErr) {
        console.warn('[SOS] Background tracking failed to start:', trackErr);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDispatched(true);
      setDispatching(false);

      // Success animation
      Animated.spring(successScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Navigate to tracking screen after a short delay
      setTimeout(() => {
        navigation.replace('TrackingActive');
      }, 2500);

    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred.');
      setDispatching(false);
    }
  }, [contacts, dispatching, dispatched, navigation, successScale]);

  const { secondsLeft, progress } = useCountdown(COUNTDOWN_SECONDS, triggerDispatch);

  const handleYes = () => {
    triggerDispatch();
  };

  const handleNo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate('Dashboard');
  };

  // Animated progress ring values
  const circumference = 2 * Math.PI * 80; // radius = 80
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const timerColor = secondsLeft <= 3 ? '#ff2d55' : secondsLeft <= 6 ? '#ff9500' : '#e91e8c';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a0621" />

      {/* Background */}
      <View style={styles.bg} />
      <View style={styles.bgBlob} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.alertBadge}>🚨 SOS ALERT</Text>
        <Text style={styles.headerTitle}>Do you want to send{'\n'}your location?</Text>
        <Text style={styles.headerSub}>
          To the 3 emergency contacts you have provided
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

        {/* SVG-like circular timer via View + border trick */}
        <View style={[styles.progressRing, { borderColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={styles.timerInner}>
            {dispatching ? (
              <ActivityIndicator size="large" color="#e91e8c" />
            ) : dispatched ? (
              <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }] }]}>
                <Text style={styles.successIcon}>✅</Text>
              </Animated.View>
            ) : (
              <>
                <Text style={[styles.countdown, { color: timerColor }]}>{secondsLeft}</Text>
                <Text style={styles.countdownLabel}>seconds</Text>
              </>
            )}
          </View>
        </View>

        {/* Animated arc overlay using Animated border */}
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
              ? '⚡ Emergency alert sent directly in the background! Tracking is now active.'
              : '🆘 Emergency alert dispatched! Tracking is now active.'}
          </Text>
        ) : dispatching ? (
          <Text style={styles.statusTextPending}>
            📡 Getting your location & dispatching alerts...
          </Text>
        ) : (
          <Text style={styles.statusTextWarning}>
            ⚠️ Alert will be sent automatically when timer reaches 0
          </Text>
        )}
        {error && <Text style={styles.errorText}>❌ {error}</Text>}
      </View>

      {/* Action Buttons */}
      {!dispatched && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btnNo, dispatching && styles.btnDisabled]}
            onPress={handleNo}
            disabled={dispatching}
            accessibilityLabel="Cancel SOS - I am safe"
            accessibilityRole="button"
          >
            <Text style={styles.btnNoIcon}>🟢</Text>
            <Text style={styles.btnNoText}>No, I am Safe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnYes, dispatching && styles.btnDisabled]}
            onPress={handleYes}
            disabled={dispatching}
            accessibilityLabel="Send SOS now"
            accessibilityRole="button"
          >
            <Text style={styles.btnYesIcon}>🆘</Text>
            <Text style={styles.btnYesText}>Yes, Send Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contact list preview */}
      {!dispatched && contacts.length > 0 && (
        <View style={styles.contactsList}>
          <Text style={styles.contactsListTitle}>Will alert:</Text>
          {contacts.map((c) => (
            <Text key={c.id} style={styles.contactsListItem}>
              • {c.name} ({c.relationship}) — {c.phone}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const PINK = '#e91e8c';
const DARK = '#1a0621';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    alignItems: 'center',
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: '#100418',
  },
  bgBlob: {
    position: 'absolute',
    top: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(233,30,140,0.08)',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 30,
    paddingHorizontal: 30,
  },
  alertBadge: {
    backgroundColor: 'rgba(233,30,140,0.2)',
    color: PINK,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(233,30,140,0.4)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 10,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  timerSection: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
  },
  progressRing: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  timerInner: {
    alignItems: 'center',
  },
  countdown: {
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  successCircle: {
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 60,
  },
  arcOverlay: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 8,
    borderColor: 'transparent',
  },
  statusSection: {
    paddingHorizontal: 30,
    marginBottom: 30,
    alignItems: 'center',
  },
  statusTextWarning: {
    color: 'rgba(255,200,80,0.9)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusTextPending: {
    color: 'rgba(150,200,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusTextSuccess: {
    color: 'rgba(100,255,160,0.9)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 24,
    width: '100%',
  },
  btnNo: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnYes: {
    flex: 1,
    backgroundColor: PINK,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnNoIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  btnNoText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
  },
  btnYesIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  btnYesText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  contactsList: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '90%',
  },
  contactsListTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  contactsListItem: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 22,
  },
});
