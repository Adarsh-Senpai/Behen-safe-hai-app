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
  Image,
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

  // SOS button pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
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

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
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
        'Setup Required',
        'Please save 3 emergency contacts before triggering SOS.',
        [
          { text: 'Configure Now', onPress: () => navigation.navigate('EmergencyContacts') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    navigation.navigate('SosCountdown', { autoTrigger: false });
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.85],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09080e" />

      {/* Modern ambient glow layers */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowCenter} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Minimal Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>
              BehenSafeHai<Text style={styles.brandAccent}>?</Text>
            </Text>
          </View>
          <Text style={styles.brandTagline}>INSTANT SOS &bull; LIVE LOCATION &bull; 100% OFFLINE</Text>
        </View>

        {/* Minimal High-Contrast Status Pills */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, hasAllContacts ? styles.pillSuccess : styles.pillWarn]}>
            <View style={[styles.statusDot, hasAllContacts ? styles.dotGreen : styles.dotAmber]} />
            <Text style={styles.statusPillText}>
              {hasAllContacts ? '3 CONTACTS SYNCED' : 'SETUP CONTACTS'}
            </Text>
          </View>
          <View style={[styles.statusPill, trackingActive ? styles.pillAlert : styles.pillIdle]}>
            <View style={[styles.statusDot, trackingActive ? styles.dotRed : styles.dotMuted]} />
            <Text style={styles.statusPillText}>
              {trackingActive ? 'TRACKING LIVE' : 'SYSTEM READY'}
            </Text>
          </View>
        </View>

        {/* Tactile SOS Trigger */}
        <View style={styles.sosSection}>
          <Text style={styles.sosHintText}>PRESS TO DISPATCH EMERGENCY ALERT</Text>

          {/* Outer glow ring */}
          <Animated.View style={[styles.sosGlowRing, { opacity: glowOpacity }]}>
            {/* Middle halo */}
            <View style={styles.sosMidRing}>
              {/* Trigger Button */}
              <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
                <TouchableOpacity
                  style={styles.sosButton}
                  onPress={handleSOSPress}
                  activeOpacity={0.88}
                  accessibilityLabel="Emergency SOS Button"
                  accessibilityRole="button"
                >
                  <View style={styles.sosButtonInner}>
                    <Text style={styles.sosButtonText}>SOS</Text>
                    <View style={styles.sosDivider} />
                    <Text style={styles.sosButtonSub}>EMERGENCY</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          <Text style={styles.sosDescription}>
            Dispatches live GPS coordinates to your 3 trusted contacts via carrier SMS
          </Text>
        </View>

        {/* Trendy Action Cards */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('EmergencyContacts')}
            activeOpacity={0.75}
            accessibilityLabel="Manage Emergency Contacts"
          >
            <View style={styles.actionCardHeader}>
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{contacts.length}/3</Text>
              </View>
              <Text style={styles.actionCardArrow}>&rarr;</Text>
            </View>
            <Text style={styles.actionCardTitle}>Trusted Contacts</Text>
            <Text style={styles.actionCardSub}>
              {loading ? 'Checking...' : hasAllContacts ? 'All 3 configured' : 'Add remaining contacts'}
            </Text>
          </TouchableOpacity>

          {trackingActive ? (
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardAlert]}
              onPress={() => navigation.navigate('TrackingActive')}
              activeOpacity={0.75}
              accessibilityLabel="View Active Tracking"
            >
              <View style={styles.actionCardHeader}>
                <View style={[styles.actionBadge, styles.actionBadgeAlert]}>
                  <Text style={[styles.actionBadgeText, styles.actionBadgeTextAlert]}>LIVE</Text>
                </View>
                <Text style={styles.actionCardArrow}>&rarr;</Text>
              </View>
              <Text style={styles.actionCardTitle}>Live GPS Radar</Text>
              <Text style={styles.actionCardSub}>Location broadcast active</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                Alert.alert(
                  'Safety Check',
                  'BehenSafeHai? runs offline on your phone without external servers or subscriptions. In emergencies, tap SOS for instant 10-second dispatch.',
                  [{ text: 'Understood' }]
                );
              }}
              activeOpacity={0.75}
            >
              <View style={styles.actionCardHeader}>
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>SECURE</Text>
                </View>
                <Text style={styles.actionCardArrow}>&rarr;</Text>
              </View>
              <Text style={styles.actionCardTitle}>Zero-Cost Safety</Text>
              <Text style={styles.actionCardSub}>Carrier SMS &bull; Offline first</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Home Screen Widget Card */}
        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => {
            Alert.alert(
              'Home Screen SOS Widget',
              'To place the one-tap SOS Widget on your phone home screen:\n\n' +
                '1. Go to your phone Home Screen.\n' +
                '2. Long-press the BehenSafeHai? app icon.\n' +
                '3. Press & hold "Emergency SOS" in the menu.\n' +
                '4. Drag and place it on your home screen.\n\n' +
                'Tapping that widget launches straight into the SOS countdown with 0 clicks!',
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
            <View style={styles.widgetTag}>
              <Text style={styles.widgetTagText}>QUICK LAUNCH</Text>
            </View>
            <Text style={styles.widgetCardArrow}>&rarr;</Text>
          </View>
          <Text style={styles.widgetCardTitle}>Home Screen SOS Widget</Text>
          <Text style={styles.widgetCardSub}>
            Pin a 1-tap emergency trigger to your home screen without opening the app
          </Text>
        </TouchableOpacity>

        {/* Direct Background Dispatch Notice */}
        <View style={styles.directSmsBanner}>
          <View style={styles.bannerDot} />
          <Text style={styles.directSmsText}>
            <Text style={styles.boldText}>DIRECT CARRIER DISPATCH: </Text>
            Standalone Android builds dispatch alerts automatically in the background.
          </Text>
        </View>

        {/* Contact List Preview */}
        {contacts.length > 0 && (
          <View style={styles.contactPreview}>
            <View style={styles.previewHeader}>
              <Text style={styles.sectionTitle}>CONFIGURED CONTACTS</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EmergencyContacts')}>
                <Text style={styles.editLink}>EDIT &rarr;</Text>
              </TouchableOpacity>
            </View>
            {contacts.map((c, i) => (
              <View key={c.id} style={styles.contactRow}>
                <View style={styles.contactIndexBadge}>
                  <Text style={styles.contactIndexText}>0{i + 1}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactPhone}>{c.phone}</Text>
                </View>
                <View style={styles.contactBadge}>
                  <Text style={styles.contactBadgeText}>{c.relationship.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
  bgGlowTop: {
    position: 'absolute',
    top: -100,
    left: '20%',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
  },
  bgGlowCenter: {
    position: 'absolute',
    top: 220,
    alignSelf: 'center',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(121, 40, 202, 0.06)',
  },
  scrollContent: {
    paddingBottom: 45,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 55,
    paddingBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: ACCENT,
  },
  brandTagline: {
    fontSize: 10,
    color: '#8e8a9f',
    marginTop: 6,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  pillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  pillWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  pillAlert: {
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderColor: 'rgba(255, 45, 85, 0.3)',
  },
  pillIdle: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotGreen: {
    backgroundColor: '#10b981',
  },
  dotAmber: {
    backgroundColor: '#f59e0b',
  },
  dotRed: {
    backgroundColor: ACCENT,
  },
  dotMuted: {
    backgroundColor: '#8e8a9f',
  },
  statusPillText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sosSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  sosHintText: {
    color: '#8e8a9f',
    fontSize: 11,
    marginBottom: 28,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  sosGlowRing: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 20,
  },
  sosMidRing: {
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 45, 85, 0.35)',
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: ACCENT_RED,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.85,
    shadowRadius: 28,
    elevation: 16,
  },
  sosButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 3,
  },
  sosDivider: {
    width: 28,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginVertical: 4,
  },
  sosButtonSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '800',
  },
  sosDescription: {
    textAlign: 'center',
    color: '#8e8a9f',
    fontSize: 12,
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 25,
    letterSpacing: 0.2,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  actionCardAlert: {
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
    borderColor: 'rgba(255, 45, 85, 0.3)',
  },
  actionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionBadgeAlert: {
    backgroundColor: ACCENT,
  },
  actionBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionBadgeTextAlert: {
    color: '#ffffff',
  },
  actionCardArrow: {
    color: '#8e8a9f',
    fontSize: 16,
    fontWeight: '700',
  },
  actionCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionCardSub: {
    color: '#8e8a9f',
    fontSize: 11,
    lineHeight: 15,
  },
  widgetCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 16,
  },
  widgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  widgetTag: {
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.3)',
  },
  widgetTagText: {
    color: ACCENT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  widgetCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  widgetCardSub: {
    color: '#8e8a9f',
    fontSize: 12,
    lineHeight: 17,
  },
  widgetCardArrow: {
    color: '#8e8a9f',
    fontSize: 16,
    fontWeight: '700',
  },
  directSmsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  directSmsText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.4,
  },
  contactPreview: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#8e8a9f',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  editLink: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  contactIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactIndexText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  contactPhone: {
    color: '#8e8a9f',
    fontSize: 12,
    marginTop: 2,
  },
  contactBadge: {
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.25)',
  },
  contactBadgeText: {
    color: ACCENT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
