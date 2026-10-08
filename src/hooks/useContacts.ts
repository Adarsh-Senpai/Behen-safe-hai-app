import { useState, useEffect, useCallback } from 'react';
import { EmergencyContact } from '../types';
import { loadContacts, saveContacts } from '../storage/contactStorage';

interface UseContactsReturn {
  contacts: EmergencyContact[];
  loading: boolean;
  saveAllContacts: (contacts: EmergencyContact[]) => Promise<void>;
  refresh: () => Promise<void>;
  hasAllContacts: boolean;
}

export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadContacts();
      setContacts(loaded);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveAllContacts = useCallback(async (updated: EmergencyContact[]) => {
    await saveContacts(updated);
    setContacts(updated);
  }, []);

  return {
    contacts,
    loading,
    saveAllContacts,
    refresh,
    hasAllContacts: contacts.length === 3,
  };
}
