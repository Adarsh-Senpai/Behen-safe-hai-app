import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList, LocationPayload } from '../types';
import { useContacts } from '../hooks/useContacts';
import {
  getCurrentLocation,
  stopBackgroundTracking,
  isBackgroundTrackingActive,
} from '../services/location/locationService';
import { dispatchSOS } from '../services/sms/smsService';

type Props = NativeStackScreenProps<RootStackParamList, 'TrackingActive'>;

export default function TrackingActiveScreen({ navigation }: Props) {
  const { contacts } = useContacts();
  const [currentLoc, setCurrentLoc] = useState<LocationPayload | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [updating, setUpdating] = useState(false);
  const [sendingUpdate, setSendingUpdate] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    // Radar scan loop
    const radar = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );
    radar.start();

    return () => {
      pulse.stop();
      radar.stop();
    };
  }, [pulseAnim, radarAnim]);

  const fetchLocation = async () => {
    setUpdating(true);
    const loc = await getCurrentLocation();
    if (loc) {
      setCurrentLoc(loc);
      setLastUpdated(new Date().toLocaleTimeString());
    }
    setUpdating(false);
  };

  useEffect(() => {
    fetchLocation();
    const interval = setInterval(fetchLocation, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleStopTracking = async () => {
    Alert.alert(
      'Confirm Safety',
      'Are you sure you want to stop emergency tracking and return to the dashboard?',
      [
        { text: 'Keep Tracking', style: 'cancel' },
        {
          text: 'Yes, I am Safe',
          style: 'destructive',
          onPress: async () => {
            await stopBackgroundTracking();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            navigation.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            });
          },
        },
      ],
    );
  };

  const handleSendUpdate = async () => {
    if (contacts.length === 0) {
      Alert.alert('No Contacts', 'No emergency contacts found to alert.');
      return;
    }

    setSendingUpdate(true);
    try {
      const loc = currentLoc || (await getCurrentLocation());
      if (!loc) {
        Alert.alert('Location Error', 'Unable to retrieve location coordinates.');
        return;
      }

      await dispatchSOS(contacts, loc);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Alert Dispatched', 'Updated location was sent to your 3 contacts.');
    } catch (err: any) {
      Alert.alert('Dispatch Error', err?.message || 'Failed to send SMS.');
    } finally {
      setSendingUpdate(false);
    }
  };

  const handleCallEmergency = (number: string = '112') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call automatically.');
    });
  };

  const radarScale = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });

  const radarOpacity = radarAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.6, 0.2, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a0621" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>🔴 LIVE TRACKING ACTIVE</Text>
          </View>
          <Text style={styles.title}>Emergency Mode</Text>
          <Text style={styles.subtitle}>
            Your location is continuously monitored and saved in background.
          </Text>
        </View>

        {/* Radar Tracker Visual */}
        <View style={styles.radarContainer}>
          <Animated.View
            style={[
              styles.radarWave,
              {
                transform: [{ scale: radarScale }],
                opacity: radarOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.radarCenter,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text style={styles.radarCenterIcon}>📡</Text>
          </Animated.View>
        </View>

        {/* Location Info Box */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>Current GPS Coordinates</Text>
            <Text style={styles.infoTime}>Updated: {lastUpdated}</Text>
          </View>

          {currentLoc ? (
            <View style={styles.coordsGrid}>
              <View style={styles.coordCol}>
                <Text style={styles.coordLabel}>LATITUDE</Text>
                <Text style={styles.coordValue}>{currentLoc.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.coordCol}>
                <Text style={styles.coordLabel}>LONGITUDE</Text>
                <Text style={styles.coordValue}>{currentLoc.longitude.toFixed(6)}</Text>
              </View>
              <View style={styles.coordCol}>
                <Text style={styles.coordLabel}>ACCURACY</Text>
                <Text style={styles.coordValue}>
                  ±{currentLoc.accuracy ? Math.round(currentLoc.accuracy) : 0}m
                </Text>
              </View>
              {currentLoc.batteryLevel !== undefined && (
                <View style={styles.coordCol}>
                  <Text style={styles.coordLabel}>BATTERY</Text>
                  <Text style={styles.coordValue}>{currentLoc.batteryLevel}%</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.fetchingText}>Acquiring GPS fix...</Text>
          )}

          {currentLoc && (
            <TouchableOpacity
              style={styles.mapLink}
              onPress={() => {
                const url = `https://maps.google.com/?q=${currentLoc.latitude},${currentLoc.longitude}`;
                Linking.openURL(url);
              }}
            >
              <Text style={styles.mapLinkText}>🌐 Open in Maps / Verify Pin →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick action buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.actionBtnUpdate}
            onPress={handleSendUpdate}
            disabled={sendingUpdate}
          >
            <Text style={styles.actionBtnText}>
              {sendingUpdate ? 'Sending...' : '📲 Send Updated SMS to 3 Contacts'}
            </Text>
          </TouchableOpacity>

          <View style={styles.callRow}>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => handleCallEmergency('112')}
            >
              <Text style={styles.callBtnText}>📞 Call 112 (National SOS)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.callBtn, styles.callBtnSecondary]}
              onPress={() => handleCallEmergency('100')}
            >
              <Text style={styles.callBtnText}>🚓 Call Police (100)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safe Stop Button */}
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStopTracking}
          activeOpacity={0.85}
        >
          <Text style={styles.stopButtonIcon}>🛡️</Text>
          <Text style={styles.stopButtonText}>I am Safe — Stop Tracking</Text>
          <Text style={styles.stopButtonSub}>
            Disables background GPS updates & returns to Dashboard
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const PINK = '#e91e8c';
const DARK = '#0d0621';
const CARD = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.12)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  alertBadge: {
    backgroundColor: 'rgba(255,59,48,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.4)',
    marginBottom: 12,
  },
  alertBadgeText: {
    color: '#ff4d4d',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  radarContainer: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  radarWave: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: '#ff2d55',
  },
  radarCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,45,85,0.2)',
    borderWidth: 2,
    borderColor: '#ff2d55',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarCenterIcon: {
    fontSize: 34,
  },
  infoCard: {
    width: '100%',
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 10,
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  infoTime: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
  },
  coordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  coordCol: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 12,
  },
  coordLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coordValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  fetchingText: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginVertical: 14,
  },
  mapLink: {
    alignItems: 'center',
    paddingTop: 6,
  },
  mapLinkText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },
  actionSection: {
    width: '100%',
    marginBottom: 22,
    gap: 10,
  },
  actionBtnUpdate: {
    backgroundColor: 'rgba(233,30,140,0.18)',
    borderWidth: 1,
    borderColor: PINK,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  callRow: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  callBtnSecondary: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderColor: 'rgba(59,130,246,0.5)',
  },
  callBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stopButton: {
    width: '100%',
    backgroundColor: '#10b981',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  stopButtonIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  stopButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stopButtonSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
  },
});
