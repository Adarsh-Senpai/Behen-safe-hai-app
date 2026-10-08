import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useContacts } from '../hooks/useContacts';
import { isBackgroundTrackingActive } from '../services/location/locationService';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { contacts, loading, hasAllContacts } = useContacts();
  const [trackingActive, setTrackingActive] = React.useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // SOS button pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    glow.start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [pulseAnim, glowAnim]);

  useEffect(() => {
    let isMounted = true;
    const checkTracking = async () => {
      try {
        const active = await isBackgroundTrackingActive();
        if (isMounted) setTrackingActive(active);
      } catch {
        if (isMounted) setTrackingActive(false);
      }
    };
    checkTracking();
    const interval = setInterval(checkTracking, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSOSPress = () => {
    if (!hasAllContacts) {
      Alert.alert(
        '⚠️ No Emergency Contacts',
        'Please set up 3 emergency contacts before activating SOS.',
        [
          { text: 'Set Up Now', onPress: () => navigation.navigate('EmergencyContacts') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    navigation.navigate('SosCountdown', { autoTrigger: false });
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.9],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0621" />

      {/* Background gradient layers */}
      <View style={styles.bgTop} />
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={styles.logoIcon}>🛡️</Text>
            <Text style={styles.logoText}>SafeHer</Text>
          </View>
          <Text style={styles.tagline}>Your safety, our priority</Text>
        </View>

        {/* Status Cards */}
        <View style={styles.statusRow}>
          <View style={[styles.statusCard, hasAllContacts ? styles.statusGood : styles.statusWarn]}>
            <Text style={styles.statusIcon}>{hasAllContacts ? '✅' : '⚠️'}</Text>
            <Text style={styles.statusLabel}>
              {hasAllContacts ? '3 Contacts Ready' : 'Contacts Missing'}
            </Text>
          </View>
          <View style={[styles.statusCard, trackingActive ? styles.statusAlert : styles.statusNeutral]}>
            <Text style={styles.statusIcon}>{trackingActive ? '📡' : '📍'}</Text>
            <Text style={styles.statusLabel}>
              {trackingActive ? 'Tracking Active' : 'Tracking Off'}
            </Text>
          </View>
        </View>

        {/* SOS Button */}
        <View style={styles.sosSection}>
          <Text style={styles.sosHintText}>Hold to activate emergency SOS</Text>

          {/* Outer glow ring */}
          <Animated.View
            style={[styles.sosGlowRing, { opacity: glowOpacity }]}
          >
            {/* Middle ring */}
            <View style={styles.sosMidRing}>
              {/* Button */}
              <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
                <TouchableOpacity
                  style={styles.sosButton}
                  onPress={handleSOSPress}
                  activeOpacity={0.85}
                  accessibilityLabel="Emergency SOS Button"
                  accessibilityRole="button"
                >
                  <Text style={styles.sosButtonIcon}>🆘</Text>
                  <Text style={styles.sosButtonText}>SOS</Text>
                  <Text style={styles.sosButtonSub}>EMERGENCY</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          <Text style={styles.sosDescription}>
            Sends your GPS location to all 3 emergency contacts instantly via SMS
          </Text>
        </View>

        {/* Action Cards */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('EmergencyContacts')}
            accessibilityLabel="Manage Emergency Contacts"
          >
            <Text style={styles.actionCardIcon}>👥</Text>
            <Text style={styles.actionCardTitle}>Emergency Contacts</Text>
            <Text style={styles.actionCardSub}>
              {loading ? 'Loading...' : `${contacts.length}/3 saved`}
            </Text>
          </TouchableOpacity>

          {trackingActive && (
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardAlert]}
              onPress={() => navigation.navigate('TrackingActive')}
              accessibilityLabel="View Active Tracking"
            >
              <Text style={styles.actionCardIcon}>🗺️</Text>
              <Text style={styles.actionCardTitle}>Live Tracking</Text>
              <Text style={styles.actionCardSub}>Emergency mode ON</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Home Screen Widget Card */}
        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => {
            Alert.alert(
              '📲 Home Screen SOS Widget',
              'To place the SOS Widget on your phone home screen:\n\n' +
                '1. Go to your phone Home Screen.\n' +
                '2. Long-press the SafeHer app icon.\n' +
                '3. Press & hold the "Emergency SOS" shortcut popup.\n' +
                '4. Drag and place it anywhere on your home screen.\n\n' +
                'Tapping that widget will cold-boot straight into the SOS countdown!',
              [
                {
                  text: 'Test Widget Trigger Now',
                  onPress: () => navigation.navigate('SosCountdown', { autoTrigger: true }),
                },
                { text: 'Got it', style: 'cancel' },
              ],
            );
          }}
          activeOpacity={0.8}
        >
          <View style={styles.widgetCardHeader}>
            <Text style={styles.widgetCardIcon}>📌</Text>
            <View style={styles.widgetCardTextWrap}>
              <Text style={styles.widgetCardTitle}>Home Screen SOS Widget</Text>
              <Text style={styles.widgetCardSub}>
                1-tap trigger from phone home screen without opening app
              </Text>
            </View>
            <Text style={styles.widgetCardArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Direct SMS Mode Banner */}
        <View style={styles.directSmsBanner}>
          <Text style={styles.directSmsIcon}>⚡</Text>
          <Text style={styles.directSmsText}>
            <Text style={styles.boldText}>Direct SMS Mode: </Text>
            In standalone Android builds, alerts are dispatched directly in background with 0 clicks.
          </Text>
        </View>

        {/* Contact List Preview */}
        {contacts.length > 0 && (
          <View style={styles.contactPreview}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            {contacts.map((c, i) => (
              <View key={c.id} style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactPhone}>{c.phone}</Text>
                </View>
                <View style={styles.contactBadge}>
                  <Text style={styles.contactBadgeText}>{c.relationship}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const PINK = '#e91e8c';
const PURPLE = '#7c3aed';
const DARK = '#0d0621';
const DARK2 = '#1a0a2e';
const CARD = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.1)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  bgTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: '#1a0a2e',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  bgBlob1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(233,30,140,0.12)',
  },
  bgBlob2: {
    position: 'absolute',
    top: 100,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    fontSize: 32,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusGood: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  statusWarn: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  statusAlert: {
    backgroundColor: 'rgba(233,30,140,0.12)',
    borderColor: 'rgba(233,30,140,0.3)',
  },
  statusNeutral: {
    backgroundColor: CARD,
    borderColor: BORDER,
  },
  statusIcon: {
    fontSize: 16,
  },
  statusLabel: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  sosSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  sosHintText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 30,
    letterSpacing: 0.3,
  },
  sosGlowRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(233,30,140,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 20,
  },
  sosMidRing: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(233,30,140,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(233,30,140,0.25)',
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: PINK,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 15,
  },
  sosButtonIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  sosButtonSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
    marginTop: 2,
  },
  sosDescription: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 24,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'flex-start',
  },
  actionCardAlert: {
    backgroundColor: 'rgba(233,30,140,0.1)',
    borderColor: 'rgba(233,30,140,0.25)',
  },
  actionCardIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  actionCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionCardSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  widgetCard: {
    backgroundColor: 'rgba(233,30,140,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(233,30,140,0.3)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  widgetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetCardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  widgetCardTextWrap: {
    flex: 1,
  },
  widgetCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  widgetCardSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 16,
  },
  widgetCardArrow: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 22,
    fontWeight: '600',
    marginLeft: 8,
  },
  directSmsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  directSmsIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  directSmsText: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
    color: '#10b981',
  },
  contactPreview: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PINK,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  contactPhone: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginTop: 2,
  },
  contactBadge: {
    backgroundColor: 'rgba(233,30,140,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(233,30,140,0.3)',
  },
  contactBadgeText: {
    color: PINK,
    fontSize: 11,
    fontWeight: '600',
  },
});
