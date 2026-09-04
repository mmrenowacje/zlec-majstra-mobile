import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingProfile = {
  firstName: string;
  lastName: string;
  role: 'customer' | 'contractor';
  phone: string;
  companyName?: string;
  companyAddress?: string;
  serviceLocation?: string;
  nip?: string;
};

const keyFor = (userId: string) => `zlecenia-remontowe:pending-profile:${userId}`;

export async function savePendingProfile(userId: string, profile: PendingProfile) {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(profile));
}

export async function loadPendingProfile(userId: string): Promise<PendingProfile | null> {
  const value = await AsyncStorage.getItem(keyFor(userId));
  if (!value) return null;
  return JSON.parse(value) as PendingProfile;
}

export async function clearPendingProfile(userId: string) {
  await AsyncStorage.removeItem(keyFor(userId));
}