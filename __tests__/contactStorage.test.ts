import { saveContacts, loadContacts, clearContacts } from '../src/storage/contactStorage';
import { EmergencyContact } from '../src/types';

describe('Emergency Contact Storage (Offline & Secure)', () => {
  beforeEach(async () => {
    await clearContacts();
  });

  const mockContacts: EmergencyContact[] = [
    { id: '1', name: 'Alice Smith', phone: '+14155552671', relationship: 'Parent' },
    { id: '2', name: 'Bob Jones', phone: '+14155552672', relationship: 'Partner' },
    { id: '3', name: 'Carol White', phone: '+14155552673', relationship: 'Friend' },
  ];

  it('loads empty array when no contacts are saved', async () => {
    const loaded = await loadContacts();
    expect(loaded).toEqual([]);
  });

  it('saves and retrieves exactly 3 emergency contacts', async () => {
    await saveContacts(mockContacts);
    const loaded = await loadContacts();

    expect(loaded).toHaveLength(3);
    expect(loaded[0].name).toBe('Alice Smith');
    expect(loaded[1].phone).toBe('+14155552672');
    expect(loaded[2].relationship).toBe('Friend');
  });

  it('clears contacts properly', async () => {
    await saveContacts(mockContacts);
    await clearContacts();
    const loaded = await loadContacts();
    expect(loaded).toEqual([]);
  });
});
