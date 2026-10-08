import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import { RootStackParamList, EmergencyContact } from '../types';
import { useContacts } from '../hooks/useContacts';
import { validatePhoneNumber, normalizePhone } from '../services/sms/smsService';

type Props = NativeStackScreenProps<RootStackParamList, 'EmergencyContacts'>;

interface ContactFormState {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

const RELATIONSHIPS = ['Parent', 'Partner', 'Sibling', 'Friend', 'Guardian', 'Relative', 'Colleague', 'Other'];

export default function EmergencyContactsScreen({ navigation }: Props) {
  const { contacts, loading, saveAllContacts } = useContacts();
  const [saving, setSaving] = useState(false);

  // Maintain 3 contact slots
  const [forms, setForms] = useState<ContactFormState[]>([
    { id: '1', name: '', phone: '', relationship: 'Parent' },
    { id: '2', name: '', phone: '', relationship: 'Partner' },
    { id: '3', name: '', phone: '', relationship: 'Friend' },
  ]);

  const [errors, setErrors] = useState<{ [key: string]: { name?: string; phone?: string } }>({});

  useEffect(() => {
    if (contacts.length > 0) {
      setForms([
        contacts[0] ? { ...contacts[0] } : { id: '1', name: '', phone: '', relationship: 'Parent' },
        contacts[1] ? { ...contacts[1] } : { id: '2', name: '', phone: '', relationship: 'Partner' },
        contacts[2] ? { ...contacts[2] } : { id: '3', name: '', phone: '', relationship: 'Friend' },
      ]);
    }
  }, [contacts]);

  const updateField = (index: number, field: keyof ContactFormState, value: string) => {
    setForms((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Clear error for field
    setErrors((prev) => {
      const copy = { ...prev };
      if (copy[index]) {
        delete copy[index][field as 'name' | 'phone'];
      }
      return copy;
    });
  };

  const inferRelationship = (name: string): string | null => {
    const lower = name.toLowerCase();
    if (
      lower.includes('mom') ||
      lower.includes('mother') ||
      lower.includes('dad') ||
      lower.includes('father') ||
      lower.includes('papa') ||
      lower.includes('maa')
    ) {
      return 'Parent';
    }
    if (
      lower.includes('bro') ||
      lower.includes('brother') ||
      lower.includes('sis') ||
      lower.includes('sister')
    ) {
      return 'Sibling';
    }
    if (
      lower.includes('husband') ||
      lower.includes('wife') ||
      lower.includes('partner') ||
      lower.includes('spouse')
    ) {
      return 'Partner';
    }
    if (lower.includes('friend') || lower.includes('bff')) {
      return 'Friend';
    }
    return null;
  };

  const handlePickFromBook = async (index: number) => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Access to contacts is required so you can select your emergency contacts directly from your address book. Please enable contact permissions in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      let selectedName = '';
      let selectedPhone = '';

      // Try modern Contact.presentPicker() first (Expo SDK 52/53 standard)
      if (Contacts.Contact && typeof Contacts.Contact.presentPicker === 'function') {
        const picked = await Contacts.Contact.presentPicker();
        if (!picked) {
          return; // User cancelled
        }

        if (typeof picked.getFullName === 'function') {
          selectedName = (await picked.getFullName()) || '';
        } else if ((picked as any).name) {
          selectedName = (picked as any).name;
        }

        if (typeof picked.getPhones === 'function') {
          const phones = await picked.getPhones();
          if (phones && phones.length > 0) {
            const preferred =
              phones.find(
                (p) =>
                  p.label?.toLowerCase().includes('mob') ||
                  p.label?.toLowerCase().includes('cell') ||
                  (p as any).isPrimary
              ) || phones[0];
            selectedPhone = preferred.number || '';
          }
        }
      } else if (typeof (Contacts as any).presentContactPickerAsync === 'function') {
        // Fallback for legacy environments
        const picked = await (Contacts as any).presentContactPickerAsync();
        if (!picked) return;
        selectedName =
          picked.name || `${picked.firstName || ''} ${picked.lastName || ''}`.trim();
        if (picked.phoneNumbers && picked.phoneNumbers.length > 0) {
          const preferred =
            picked.phoneNumbers.find(
              (p: any) =>
                p.label?.toLowerCase().includes('mob') ||
                p.label?.toLowerCase().includes('cell') ||
                p.isPrimary
            ) || picked.phoneNumbers[0];
          selectedPhone = preferred.number || '';
        }
      }

      if (!selectedName && !selectedPhone) {
        return;
      }

      const inferredRel = selectedName ? inferRelationship(selectedName) : null;

      // Populate form
      setForms((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          name: selectedName || updated[index].name,
          phone: selectedPhone || updated[index].phone,
          relationship: inferredRel || updated[index].relationship,
        };
        return updated;
      });

      // Clear field errors
      setErrors((prev) => {
        const copy = { ...prev };
        if (copy[index]) {
          if (selectedName) delete copy[index].name;
          if (selectedPhone) delete copy[index].phone;
        }
        return copy;
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (!selectedPhone) {
        Alert.alert(
          'No Phone Number Found',
          `"${selectedName || 'The contact'}" was selected, but does not have a saved phone number in your address book. Please enter their mobile number manually.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      console.warn('[Contacts] Error picking contact:', err);
      Alert.alert(
        'Could Not Pick Contact',
        err?.message ||
          'An error occurred while opening the contact book. Please enter the details manually.'
      );
    }
  };

  const validateAll = (): boolean => {
    const newErrors: { [key: string]: { name?: string; phone?: string } } = {};
    let isValid = true;

    forms.forEach((item, index) => {
      const err: { name?: string; phone?: string } = {};

      if (!item.name.trim()) {
        err.name = 'Contact name is required';
        isValid = false;
      }

      if (!item.phone.trim()) {
        err.phone = 'Mobile number is required';
        isValid = false;
      } else if (!validatePhoneNumber(item.phone)) {
        err.phone = 'Enter a valid phone number (min 7-15 digits)';
        isValid = false;
      }

      if (Object.keys(err).length > 0) {
        newErrors[index] = err;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validateAll()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        'Incomplete Information',
        'Please provide valid names and phone numbers for all 3 emergency contacts.',
      );
      return;
    }

    setSaving(true);
    try {
      const formatted: EmergencyContact[] = forms.map((f, i) => ({
        id: f.id || `contact-${i + 1}-${Date.now()}`,
        name: f.name.trim(),
        phone: normalizePhone(f.phone),
        relationship: f.relationship || 'Emergency Contact',
      }));

      await saveAllContacts(formatted);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      Alert.alert(
        'Contacts Saved',
        'All 3 emergency contacts have been saved securely on this device.',
        [
          {
            text: 'Return to Dashboard',
            onPress: () => navigation.navigate('Dashboard'),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save contacts.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#e91e8c" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0d0621" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Emergency Contacts</Text>
            <Text style={styles.headerSub}>Setup exactly 3 trusted contacts for SOS alerts</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxIcon}>ℹ️</Text>
          <Text style={styles.infoBoxText}>
            When SOS is triggered, your GPS location will automatically be dispatched to these 3 contacts via SMS. Tap "Pick from Phone" on any card to select directly from your address book, or type manually.
          </Text>
        </View>

        {forms.map((item, index) => {
          const itemErrors = errors[index] || {};

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.badgeIndex}>
                    <Text style={styles.badgeIndexText}>#{index + 1}</Text>
                  </View>
                  <Text style={styles.cardTitle}>Contact {index + 1}</Text>
                </View>
                <TouchableOpacity
                  style={styles.pickButton}
                  onPress={() => handlePickFromBook(index)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Pick Contact ${index + 1} from phone book`}
                >
                  <Text style={styles.pickButtonIcon}>📖</Text>
                  <Text style={styles.pickButtonText}>Pick from Phone</Text>
                </TouchableOpacity>
              </View>

              {/* Name field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={[styles.input, itemErrors.name ? styles.inputError : null]}
                  placeholder="e.g. Mom, Sarah Johnson"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={item.name}
                  onChangeText={(val) => updateField(index, 'name', val)}
                  autoCapitalize="words"
                />
                {itemErrors.name ? (
                  <Text style={styles.errorText}>⚠️ {itemErrors.name}</Text>
                ) : null}
              </View>

              {/* Phone field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Mobile Number (with country code if needed)</Text>
                <TextInput
                  style={[styles.input, itemErrors.phone ? styles.inputError : null]}
                  placeholder="e.g. +14155552671 or 9876543210"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={item.phone}
                  onChangeText={(val) => updateField(index, 'phone', val)}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                {itemErrors.phone ? (
                  <Text style={styles.errorText}>⚠️ {itemErrors.phone}</Text>
                ) : null}
              </View>

              {/* Relationship picker chips */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Relationship</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {RELATIONSHIPS.map((rel) => {
                    const isSelected = item.relationship === rel;
                    return (
                      <TouchableOpacity
                        key={rel}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => updateField(index, 'relationship', rel)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {rel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save 3 Emergency Contacts</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  centerContainer: {
    flex: 1,
    backgroundColor: DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(233,30,140,0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(233,30,140,0.25)',
    marginBottom: 22,
  },
  infoBoxIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  infoBoxText: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeIndex: {
    backgroundColor: PINK,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  badgeIndexText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 30, 140, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 140, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  pickButtonIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  pickButtonText: {
    color: '#ff4081',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  inputError: {
    borderColor: '#ff4d4d',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  chipsScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipSelected: {
    backgroundColor: PINK,
    borderColor: PINK,
  },
  chipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: PINK,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
