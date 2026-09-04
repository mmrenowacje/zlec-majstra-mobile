import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getGetMyProfileQueryKey,
  useUpdateMyProfile,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import {
  clearPendingProfile,
  loadPendingProfile,
  type PendingProfile,
} from '@/lib/pending-profile';

const emptyProfile: PendingProfile = {
  firstName: '',
  lastName: '',
  role: 'customer',
  phone: '',
};

function messageFor(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Spróbuj ponownie.';
  const candidate = error as { message?: string; longMessage?: string };
  return candidate.longMessage ?? candidate.message ?? 'Spróbuj ponownie.';
}

export default function CompleteProfileScreen() {
  const colors = useColors();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateMyProfile();
  const [profile, setProfile] = useState<PendingProfile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    loadPendingProfile(userId)
      .then((pending) => {
        if (pending) setProfile(pending);
      })
      .finally(() => setLoaded(true));
  }, [userId]);

  const save = async () => {
    if (
      !profile.firstName.trim() ||
      !profile.lastName.trim() ||
      profile.phone.trim().length < 7
    ) {
      setError('Podaj imię, nazwisko i poprawny numer telefonu.');
      return;
    }
    if (
      profile.role === 'contractor' &&
      (!profile.companyName?.trim() ||
        !profile.companyAddress?.trim() ||
        !profile.serviceLocation?.trim() ||
        !/^\d{10}$/.test(profile.nip ?? ''))
    ) {
      setError('Podaj nazwę firmy, adres firmy, miejscowość obsługi i poprawny 10-cyfrowy NIP.');
      return;
    }

    try {
      setError('');
      await updateProfile.mutateAsync({
        data: {
          ...profile,
          firstName: profile.firstName.trim(),
          lastName: profile.lastName.trim(),
          phone: profile.phone.trim(),
          companyName: profile.role === 'contractor' ? profile.companyName?.trim() : null,
          companyAddress: profile.role === 'contractor' ? profile.companyAddress?.trim() : null,
          serviceLocation: profile.role === 'contractor' ? profile.serviceLocation?.trim() : null,
          nip: profile.role === 'contractor' ? profile.nip : null,
        },
      });
      if (userId) await clearPendingProfile(userId);
      await queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
    } catch (saveError) {
      setError(`Nie udało się zapisać profilu. ${messageFor(saveError)}`);
    }
  };

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      bottomOffset={72}
    >
      <View style={[styles.brandMark, { backgroundColor: colors.foreground }]}>
        <Feather name="check" size={24} color={colors.primary} />
      </View>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>EMAIL POTWIERDZONY</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Dokończ profil</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Zapisz dane konta, aby przejść do zleceń.
      </Text>

      <View style={styles.nameRow}>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>Imię</Text>
          <TextInput
            testID="complete-profile-first-name"
            value={profile.firstName}
            onChangeText={(firstName) => setProfile((current) => ({ ...current, firstName }))}
            placeholder="Jan"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>Nazwisko</Text>
          <TextInput
            testID="complete-profile-last-name"
            value={profile.lastName}
            onChangeText={(lastName) => setProfile((current) => ({ ...current, lastName }))}
            placeholder="Kowalski"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>Rola</Text>
      <View style={styles.roleRow}>
        {([
          ['customer', 'Klient'],
          ['contractor', 'Fachowiec / firma'],
        ] as const).map(([role, label]) => (
          <Pressable
            key={role}
            testID={`complete-profile-role-${role}`}
            onPress={() => setProfile((current) => ({ ...current, role }))}
            style={[
              styles.roleButton,
              { backgroundColor: profile.role === role ? colors.foreground : colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: profile.role === role ? colors.background : colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>Telefon</Text>
      <TextInput
        testID="complete-profile-phone"
        value={profile.phone}
        onChangeText={(phone) => setProfile((current) => ({ ...current, phone }))}
        placeholder="+48 500 600 700"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="phone-pad"
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
      />

      {profile.role === 'contractor' && (
        <View style={[styles.companyFields, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.companyTitle, { color: colors.foreground }]}>Dane firmy</Text>
          <TextInput
            testID="complete-profile-company-name"
            value={profile.companyName ?? ''}
            onChangeText={(companyName) => setProfile((current) => ({ ...current, companyName }))}
            placeholder="Nazwa firmy"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
          />
          <TextInput
            testID="complete-profile-company-address"
            value={profile.companyAddress ?? ''}
            onChangeText={(companyAddress) => setProfile((current) => ({ ...current, companyAddress }))}
            placeholder="Adres firmy"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
          />
          <TextInput
            testID="complete-profile-service-location"
            value={profile.serviceLocation ?? ''}
            onChangeText={(serviceLocation) => setProfile((current) => ({ ...current, serviceLocation }))}
            placeholder="Miejscowość obsługi, np. Warszawa"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
          />
          <TextInput
            testID="complete-profile-nip"
            value={profile.nip ?? ''}
            onChangeText={(nip) => setProfile((current) => ({ ...current, nip: nip.replace(/\D/g, '').slice(0, 10) }))}
            placeholder="NIP — 10 cyfr"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={10}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
          />
        </View>
      )}

      {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
      <Pressable
        testID="complete-profile-submit"
        onPress={save}
        disabled={updateProfile.isPending}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary, opacity: updateProfile.isPending || pressed ? 0.65 : 1 },
        ]}
      >
        <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
          {updateProfile.isPending ? 'Zapisuję…' : 'Przejdź do aplikacji'}
        </Text>
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, paddingTop: 64, paddingBottom: 40, justifyContent: 'center', gap: 9 },
  brandMark: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginTop: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, marginTop: 2 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginBottom: 14 },
  nameRow: { flexDirection: 'row', gap: 9 },
  halfField: { flex: 1 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 5, marginBottom: 2 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontFamily: 'Inter_500Medium', fontSize: 15 },
  roleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  roleButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10 },
  companyFields: { gap: 9, borderWidth: 1, borderRadius: 18, padding: 12, marginTop: 6 },
  companyTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 1 },
  error: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19, marginTop: 3 },
  primaryButton: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});