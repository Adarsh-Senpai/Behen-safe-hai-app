// Mock native modules for unit testing
jest.mock('expo-sms', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  sendSMSAsync: jest.fn().mockResolvedValue({ result: 'sent' }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 28.6139,
      longitude: 77.2090,
      accuracy: 10,
    },
    timestamp: Date.now(),
  }),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
  Accuracy: {
    High: 5,
    Balanced: 3,
  },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn().mockResolvedValue(0.85),
}));

jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  Contact: {
    presentPicker: jest.fn().mockResolvedValue({
      id: 'test-1',
      name: 'Alice Johnson',
      getFullName: jest.fn().mockResolvedValue('Alice Johnson'),
      getPhones: jest.fn().mockResolvedValue([
        { id: 'p1', number: '+14155552671', label: 'mobile' },
      ]),
    }),
  },
  presentContactPickerAsync: jest.fn().mockResolvedValue({
    id: 'test-1',
    name: 'Alice Johnson',
    phoneNumbers: [{ number: '+14155552671', label: 'mobile' }],
  }),
}));

jest.mock('expo-secure-store', () => {
  let store = {};
  return {
    setItemAsync: jest.fn(async (key, val) => {
      store[key] = val;
    }),
    getItemAsync: jest.fn(async (key) => {
      return store[key] || null;
    }),
    deleteItemAsync: jest.fn(async (key) => {
      delete store[key];
    }),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-quick-actions', () => ({
  isSupported: jest.fn().mockResolvedValue(true),
  setItems: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  initial: undefined,
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (objs) => objs.android,
  },
  Linking: {
    canOpenURL: jest.fn().mockResolvedValue(true),
    openURL: jest.fn().mockResolvedValue(true),
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    getInitialURL: jest.fn().mockResolvedValue(null),
  },
  Animated: {
    Value: jest.fn().mockImplementation(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn().mockReturnValue('0deg'),
    })),
    timing: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
    sequence: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
    parallel: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
    loop: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
  },
  LogBox: {
    ignoreLogs: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  StyleSheet: {
    create: (styles) => styles,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  StatusBar: 'StatusBar',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
}));

jest.mock('expo-audio', () => {
  const mockRecorder = {
    id: 'test-recorder',
    isRecording: false,
    uri: 'file:///test-emergency-audio.m4a',
    currentTime: 10,
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockImplementation(() => {
      mockRecorder.isRecording = true;
    }),
    stop: jest.fn().mockImplementation(async () => {
      mockRecorder.isRecording = false;
    }),
    getStatus: jest.fn().mockReturnValue({ isRecording: true, durationMillis: 10000 }),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };

  return {
    AudioModule: {
      AudioRecorder: jest.fn().mockImplementation(() => mockRecorder),
      requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
      getRecordingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    },
    requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    getRecordingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    RecordingPresets: {
      LOW_QUALITY: { extension: '.m4a', sampleRate: 16000, bitRate: 32000 },
      HIGH_QUALITY: { extension: '.m4a', sampleRate: 44100, bitRate: 128000 },
    },
  };
});

