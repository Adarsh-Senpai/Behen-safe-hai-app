import React, { useEffect } from 'react';
import { Platform, Linking, LogBox } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as QuickActions from 'expo-quick-actions';
import { RootStackParamList } from './src/types';

// Screens
import DashboardScreen from './src/screens/DashboardScreen';
import SosCountdownScreen from './src/screens/SosCountdownScreen';
import EmergencyContactsScreen from './src/screens/EmergencyContactsScreen';
import TrackingActiveScreen from './src/screens/TrackingActiveScreen';

// Ignore non-fatal development logs
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  '[Storage]',
  'AsyncStorage',
]);

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Deep Linking Configuration ─────────────────────────────────────────────
const linking = {
  prefixes: ['womensafety://', 'exp://'],
  config: {
    screens: {
      Dashboard: '',
      SosCountdown: 'sos',
      EmergencyContacts: 'contacts',
      TrackingActive: 'tracking',
    },
  },
};

export default function App() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    // 1. Setup Quick Actions on Home Screen (iOS 3D Touch / Android App Shortcuts)
    const setupQuickActions = async () => {
      try {
        const supported = await QuickActions.isSupported();
        if (supported) {
          await QuickActions.setItems([
            {
              id: 'sos',
              title: 'Emergency SOS',
              subtitle: 'One-tap 10s emergency dispatch',
              icon: Platform.OS === 'ios' ? 'symbol:exclamationmark.triangle.fill' : 'ic_launcher',
              params: { href: 'womensafety://sos' },
            },
          ]);
        }
      } catch (err) {
        console.warn('[QuickActions] Setup failed:', err);
      }
    };

    setupQuickActions();

    // 2. Handle cold-boot launch from Quick Action
    try {
      if (QuickActions?.initial && QuickActions.initial.id === 'sos') {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('SosCountdown', { autoTrigger: true });
          }
        }, 300);
      }
    } catch (err) {
      console.warn('[QuickActions] initial check skipped:', err);
    }

    // 3. Handle warm-boot or active Quick Action event
    let subscription: { remove: () => void } | undefined;
    try {
      if (QuickActions?.addListener) {
        subscription = QuickActions.addListener((action) => {
          if (action?.id === 'sos' && navigationRef.isReady()) {
            navigationRef.navigate('SosCountdown', { autoTrigger: true });
          }
        });
      }
    } catch (err) {
      console.warn('[QuickActions] addListener skipped:', err);
    }

    // 4. Handle custom URL scheme cold-boot and background events (womensafety://sos)
    const handleUrl = ({ url }: { url: string }) => {
      if (url.includes('sos') && navigationRef.isReady()) {
        navigationRef.navigate('SosCountdown', { autoTrigger: true });
      }
    };

    const linkSub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && initialUrl.includes('sos')) {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('SosCountdown', { autoTrigger: true });
          }
        }, 300);
      }
    });

    return () => {
      subscription?.remove();
      linkSub.remove();
    };
  }, [navigationRef]);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#0d0621' },
          }}
        >
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen
            name="SosCountdown"
            component={SosCountdownScreen}
            options={{
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="EmergencyContacts"
            component={EmergencyContactsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="TrackingActive"
            component={TrackingActiveScreen}
            options={{
              animation: 'slide_from_bottom',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
