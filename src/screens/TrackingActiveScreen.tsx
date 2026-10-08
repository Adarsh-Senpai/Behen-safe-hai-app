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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList, LocationPayload } from '../types';
import { useContacts } from '../hooks/useContacts';
import {
  getCurrentLocation,
  stopBackgroundTracking,
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
      Alert.alert('Alert Dispatched', 'Updated location coordinates sent to your 3 contacts.');
    } catch (err: any) {
      Alert.alert('Dispatch Error', err?.message || 'Failed to send SMS.');
    } finally {
      setSendingUpdate(false);
    }
  };

  const handleCallEmergency = (number: string = '112') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call automatically.');
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
      <StatusBar barStyle="light-content" backgroundColor="#09080e" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.alertBadge}>
            <View style={styles.livePulseDot} />
            <Text style={styles.alertBadgeText}>LIVE GPS TRACKING</Text>
          </View>
          <Text style={styles.title}>Emergency Beacon Active</Text>
          <Text style={styles.subtitle}>
            Your coordinates are continuously monitored and logged in background
          </Text>
        </View>

        {/* Minimal Geometric Radar Tracker */}
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
            <View style={styles.radarTargetRing}>
              <View style={styles.radarCoreDot} />
            </View>
          </Animated.View>
        </View>

        {/* Location Info Box */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>LIVE GPS COORDINATES</Text>
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
                  &plusmn;{currentLoc.accuracy ? Math.round(currentLoc.accuracy) : 0}m
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
            <Text style={styles.fetchingText}>Acquiring high-precision GPS lock...</Text>
          )}

          {currentLoc && (
            <TouchableOpacity
              style={styles.mapLink}
              onPress={() => {
                const url = `https://maps.google.com/?q=${currentLoc.latitude},${currentLoc.longitude}`;
                Linking.openURL(url);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.mapLinkText}>View Live Pin in Google Maps &rarr;</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick action buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.actionBtnUpdate}
            onPress={handleSendUpdate}
            disabled={sendingUpdate}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>
              {sendingUpdate ? 'Broadcasting...' : 'Broadcast Updated Location SMS'}
            </Text>
          </TouchableOpacity>

          <View style={styles.callRow}>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => handleCallEmergency('112')}
              activeOpacity={0.8}
            >
              <Text style={styles.callBtnText}>Call 112 (National SOS)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.callBtn, styles.callBtnSecondary]}
              onPress={() => handleCallEmergency('100')}
              activeOpacity={0.8}
            >
              <Text style={styles.callBtnText}>Call Police (100)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safe Stop Button */}
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStopTracking}
          activeOpacity={0.85}
        >
          <Text style={styles.stopButtonText}>I am Safe &bull; Stop Emergency Tracking</Text>
          <Text style={styles.stopButtonSub}>
            Halts background GPS updates and returns to Dashboard
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 45,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.35)',
    marginBottom: 14,
    gap: 8,
  },
  livePulseDot: {
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
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    color: '#8e8a9f',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  radarContainer: {
    width: 170,
    height: 170,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 18,
  },
  radarWave: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: 'rgba(255, 45, 85, 0.06)',
  },
  radarCenter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 45, 85, 0.4)',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  radarTargetRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarCoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  infoCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoTitle: {
    color: '#8e8a9f',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  infoTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  coordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  coordCol: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  coordLabel: {
    color: '#8e8a9f',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  coordValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fetchingText: {
    color: '#8e8a9f',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
  mapLink: {
    marginTop: 8,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.25)',
  },
  mapLinkText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionSection: {
    gap: 12,
    marginBottom: 22,
  },
  actionBtnUpdate: {
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.4)',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  callRow: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  callBtnSecondary: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  callBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stopButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  stopButtonText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  stopButtonSub: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});
