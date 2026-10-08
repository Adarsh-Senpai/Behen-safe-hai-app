# BehenSafeHai? — Women Safety Mobile Application

BehenSafeHai? is a production-grade, 100% free-to-operate Women Safety application built with React Native and Expo (TypeScript). It operates completely independently of expensive third-party SMS or mapping API keys, leveraging the device's native carrier SMS connection and standard GPS navigation URLs.

---

## Key Architecture & Features

1. **Phone Home Screen Widget & Native App Shortcuts (1-Tap SOS)**
   - Configured via `expo-quick-actions` with custom URL scheme `womensafety://sos`.
   - **Pinned Home Screen Widget:** Long-press the BehenSafeHai? app icon, hold "Emergency SOS", and drag it to your phone's home screen. Tapping it cold-boots straight into the countdown with **zero app browsing**.
   - **Android Native App Widget:** Includes native AppWidgetProvider config plugin (`plugins/withSosWidget.js`) rendering a sleek obsidian & electric crimson emergency widget for the Android widget drawer.

2. **10-Second Auto-Dispatch Fail-Safe**
   - High-contrast visual countdown screen with pulsing rings and multi-stage haptic feedback (`expo-haptics`).
   - If the user is incapacitated or does not interact, the app **automatically dispatches** emergency alerts once the timer reaches 0.
   - User can manually tap **[Yes, Send Now]** to bypass the countdown or **[No, I am Safe]** to safely abort.

3. **Offline-First Secure Emergency Contacts Management**
   - Storage of exactly 3 emergency contacts (Name, Mobile Number, Relationship).
   - Validation for international and domestic phone number formats.
   - 100% offline encrypted device persistence using `expo-secure-store` with in-memory caching.

4. **Zero-Cost Direct Background SMS & Dispatch Engine**
   - Requests foreground and background GPS permissions (`expo-location`).
   - Retrieves high-accuracy coordinates and device battery level (`expo-battery`).
   - **Direct Background SMS (Zero Clicks):** In standalone Android builds (`eas build` / `npx expo run:android`), the app uses native `SmsManager` with `android.permission.SEND_SMS` to dispatch SMS to all 3 contacts silently in the background **without opening the messaging app or requiring manual clicks**.
   - **Safe Fallback:** In Expo Go or iOS, automatically uses `expo-sms` / `sms:` URI scheme.

5. **Real-Time Background Tracking**
   - Background location task registered with `expo-task-manager` and `Location.startLocationUpdatesAsync`.
   - Persistent foreground service notification on Android: *"🔴 Emergency Tracking Active"*.
   - In-app Live Tracking dashboard displaying coordinates, battery, and a one-tap safety disarm button.

---

## 📂 Project Directory Layout

```
├── __tests__/                   # Jest unit test suites
│   ├── contactStorage.test.ts   # Offline storage tests
│   ├── locationService.test.ts  # Location & background task tests
│   └── smsService.test.ts       # SMS payload & phone validation tests
├── src/
│   ├── hooks/
│   │   ├── useContacts.ts       # Hook for loading & updating contacts
│   │   └── useCountdown.ts      # 10s countdown hook with haptic escalation
│   ├── screens/
│   │   ├── DashboardScreen.tsx          # Main dashboard & pulsing SOS trigger
│   │   ├── SosCountdownScreen.tsx       # 10s circular countdown & auto-dispatch
│   │   ├── EmergencyContactsScreen.tsx  # 3 contacts setup & validation
│   │   └── TrackingActiveScreen.tsx     # Real-time tracking dashboard & safety stop
│   ├── services/
│   │   ├── location/
│   │   │   └── locationService.ts       # GPS, background task & payload builder
│   │   └── sms/
│   │       └── smsService.ts            # Zero-cost native carrier SMS dispatch
│   ├── storage/
│   │   └── contactStorage.ts    # AsyncStorage persistence layer
│   └── types/
│       └── index.ts             # TypeScript definitions & navigation types
├── App.tsx                      # Root navigator & Quick Actions setup
├── app.json                     # Native permissions & scheme configuration
├── jest.config.js               # Jest configuration
└── tsconfig.json                # TypeScript configuration
```

---

## 🚀 Running the Project

### Prerequisites
- Node.js (v18+)
- Physical iOS or Android device with the **Expo Go** app installed (or an emulator/simulator).

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npx expo start
```
- Scan the QR code using the **Expo Go** app on Android or the Camera app on iOS.

---

## 🧪 Testing Features

### Testing on Expo Go
1. **Set Up Emergency Contacts:**
   - On the Dashboard, tap **Emergency Contacts**.
   - Fill in 3 contacts (Name, Mobile Number, Relationship).
   - Tap **Save 3 Emergency Contacts**.
2. **Test 10-Second Auto-Dispatch:**
   - Tap the large **SOS** button on the Dashboard.
   - Observe the 10-second timer countdown and escalating haptic pulses.
   - Let the timer run down to 0: the app will automatically fetch coordinates and prepare the SMS dispatch to all 3 contacts.
3. **Test Cancel:**
   - Trigger SOS and tap **[No, I am Safe]** to abort.
4. **Test Real-Time Tracking:**
   - After dispatching, the app transitions to the **Live Tracking** screen.
   - Tap **[I am Safe — Stop Tracking]** to stop background location tracking.

### Testing Home Screen Quick Actions & URL Schemes
1. **Deep Link / URL Scheme (`womensafety://sos`):**
   - On Android:
     ```bash
     npx uri-scheme open womensafety://sos --android
     ```
   - On iOS:
     ```bash
     npx uri-scheme open womensafety://sos --ios
     ```
   - The app will immediately cold-boot or navigate directly to the `SosCountdownScreen`.
2. **App Launcher Quick Action:**
   - On a standalone or development build, long-press the **BehenSafeHai?** app icon on the home screen.
   - Tap **Emergency SOS** to launch directly into countdown mode.

---

## 📦 Building Standalone App (EAS Build)

To build standalone APK/AAB or IPA binaries with native background location service permissions:

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```
2. **Log into Expo:**
   ```bash
   eas login
   ```
3. **Configure EAS Project:**
   ```bash
   eas build:configure
   ```
4. **Build Android APK (for direct sideload testing):**
   ```bash
   eas build --platform android --profile preview
   ```
5. **Build Production (Google Play / App Store):**
   ```bash
   eas build --platform all
   ```

---

## Running Unit Tests

BehenSafeHai? includes unit tests covering:
- International & domestic phone validation
- Emergency message payload generation
- Offline contact persistence
- Location permission and background task registration

Run the test suite:
```bash
npm test
```
Typecheck the codebase:
```bash
npx tsc --noEmit
```
