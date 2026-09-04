import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getGetMyProfileQueryKey, getPaymentStatus, useGetMyProfile, useGetSubscription, useStartSubscription, useUpdateMyProfile } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useClerk, useUser } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

export default function ProfileScreen() {
  const colors = useColors();
  const { signOut } = useClerk();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const returnParams = useLocalSearchParams<{ order?: string }>();
  const profile = useGetMyProfile();
  const subscription = useGetSubscription();
  const start = useStartSubscription();
  const updateProfile = useUpdateMyProfile();
  const [editing, setEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [paymentConsents, setPaymentConsents] = useState({
    terms: false,
    digitalService: false,
    recurringPayments: false,
  });
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', companyName: '', companyAddress: '', serviceLocation: '', nip: '' });
  const status = subscription.data?.status ?? 'inactive';
  const statusLabel = {
    active: 'Aktywny',
    past_due: 'Płatność wymaga uwagi',
    canceled: 'Anulowany',
    inactive: 'Nieaktywny',
  }[status];

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      firstName: profile.data.firstName,
      lastName: profile.data.lastName,
      phone: profile.data.phone,
      companyName: profile.data.companyName ?? '',
      companyAddress: profile.data.companyAddress ?? '',
      serviceLocation: profile.data.serviceLocation ?? '',
      nip: profile.data.nip ?? '',
    });
  }, [profile.data]);

  const saveProfile = async () => {
    if (!profile.data) return;
    if (!form.firstName.trim() || !form.lastName.trim() || form.phone.trim().length < 7) {
      Alert.alert('Uzupełnij profil', 'Podaj imię, nazwisko i poprawny numer telefonu.');
      return;
    }
    if (
      profile.data.role === 'contractor' &&
      (!form.companyName.trim() ||
        !form.companyAddress.trim() ||
        !form.serviceLocation.trim() ||
        !/^\d{10}$/.test(form.nip.trim()))
    ) {
      Alert.alert('Uzupełnij dane firmy', 'Podaj nazwę firmy, adres firmy, miejscowość obsługi i poprawny 10-cyfrowy NIP.');
      return;
    }
    try {
      const updated = await updateProfile.mutateAsync({
        data: {
          role: profile.data.role === 'contractor' ? 'contractor' : 'customer',
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          companyName: profile.data.role === 'contractor' ? form.companyName.trim() : null,
          companyAddress: profile.data.role === 'contractor' ? form.companyAddress.trim() : null,
          serviceLocation: profile.data.role === 'contractor' ? form.serviceLocation.trim() : null,
          nip: profile.data.role === 'contractor' ? form.nip.trim() : null,
        },
      });
      queryClient.setQueryData(getGetMyProfileQueryKey(), updated);
      setEditing(false);
      Alert.alert('Profil zapisany', 'Twoje dane zostały zaktualizowane.');
    } catch {
      Alert.alert('Nie udało się zapisać profilu', 'Spróbuj ponownie za chwilę.');
    }
  };

  const chooseProfileImage = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Potrzebna zgoda', 'Zezwól aplikacji na dostęp do zdjęć.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled) return;
    try {
      setUploadingImage(true);
      const asset = result.assets[0];
      if (!asset.base64) {
        throw new Error('Brak danych wybranego zdjęcia');
      }
      const mimeType = asset.mimeType?.startsWith('image/')
        ? asset.mimeType
        : 'image/jpeg';
      await user.setProfileImage({
        file: `data:${mimeType};base64,${asset.base64}`,
      });
      await user.reload();
      await queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
    } catch (error) {
      const clerkMessage =
        typeof error === 'object' &&
        error !== null &&
        'errors' in error &&
        Array.isArray(error.errors) &&
        typeof error.errors[0]?.longMessage === 'string'
          ? error.errors[0].longMessage
          : null;
      Alert.alert(
        'Nie udało się przesłać zdjęcia',
        clerkMessage ?? 'Wybierz obraz JPG, PNG lub WebP i spróbuj ponownie.',
      );
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    const returnedOrder = returnParams.order;
    if (!returnedOrder) return;
    let cancelled = false;
    void (async () => {
      let finalStatus = 'pending';
      for (let attempt = 0; attempt < 15 && !['completed', 'canceled', 'failed'].includes(finalStatus); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const current = await getPaymentStatus(returnedOrder);
        finalStatus = current.status;
      }
      if (cancelled) return;
      await subscription.refetch();
      Alert.alert(
        'Status płatności',
        finalStatus === 'completed'
          ? 'Płatność potwierdzona. Abonament jest aktywny.'
          : finalStatus === 'canceled'
            ? 'Płatność została anulowana.'
            : finalStatus === 'failed'
              ? 'Płatność nie powiodła się.'
              : 'PayU nadal przetwarza płatność. Status odświeży się przy ponownym otwarciu profilu.',
      );
    })().catch(() => {
      if (!cancelled) {
        Alert.alert('Nie udało się sprawdzić płatności', 'Otwórz profil ponownie za chwilę.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [returnParams.order]);

  const requestActivation = () => {
    if (!paymentConsents.terms || !paymentConsents.digitalService || !paymentConsents.recurringPayments) {
      Alert.alert('Wymagane zgody', 'Zaakceptuj wszystkie trzy zgody dotyczące regulaminu, rozpoczęcia usługi i płatności cyklicznych.');
      return;
    }
    start.mutate(
      { data: { plan: 'professional', platform: 'mobile', acceptTerms: true, acceptDigitalService: true, acceptRecurringPayments: true } },
      {
        onSuccess: async (result) => {
          if (!result.redirectUri) {
            await subscription.refetch();
            return;
          }
          const authSession = await WebBrowser.openAuthSessionAsync(result.redirectUri, MOBILE_BILLING_RETURN_URL);
          if (authSession.type === 'success' && authSession.url) {
            const returnedOrder = new URL(authSession.url).searchParams.get('order');
            if (returnedOrder && returnedOrder !== result.extOrderId) {
              Alert.alert('Nieprawidłowy powrót z PayU', 'Nie udało się potwierdzić zamówienia. Otwórz płatność ponownie.');
              return;
            }
          }
          let finalStatus = result.status;
          for (let attempt = 0; attempt < 15 && !['completed', 'canceled', 'failed'].includes(finalStatus); attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const current = await getPaymentStatus(result.extOrderId);
            finalStatus = current.status;
          }
          await subscription.refetch();
          Alert.alert(
            'Status płatności',
            finalStatus === 'completed'
              ? 'Płatność potwierdzona. Abonament jest aktywny.'
              : finalStatus === 'canceled'
                ? 'Płatność została anulowana.'
                : finalStatus === 'failed'
                  ? 'Płatność nie powiodła się.'
                  : 'PayU nadal przetwarza płatność. Status odświeży się przy ponownym otwarciu profilu.',
          );
        },
        onError: () => Alert.alert('Nie udało się rozpocząć płatności PayU', 'Spróbuj ponownie za chwilę.'),
      },
    );
  };

  if (profile.isLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {profile.data?.profileImageUrl
        ? <Image source={{ uri: profile.data.profileImageUrl }} style={styles.avatarImage} />
        : <View style={[styles.avatar, { backgroundColor: colors.foreground }]}><Text style={[styles.avatarText, { color: colors.background }]}>{profile.data?.firstName?.[0] ?? 'U'}</Text></View>}
      <Text style={[styles.name, { color: colors.foreground }]}>{profile.data?.firstName} {profile.data?.lastName}</Text>
      <Text style={[styles.company, { color: colors.mutedForeground }]}>{profile.data?.companyName ?? 'Konto klienta indywidualnego'}</Text>
      <View style={[styles.verified, { backgroundColor: profile.data?.verified ? colors.secondary : colors.muted }]}>
        <Feather name={profile.data?.verified ? 'check-circle' : 'alert-circle'} size={17} color={colors.foreground} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{profile.data?.verified ? 'Konto zweryfikowane' : 'Zweryfikuj email kodem'}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.accent }]}>DANE KONTA</Text>
        {[
          ['mail', profile.data?.email],
          ['phone', profile.data?.phone],
          ['briefcase', profile.data?.role === 'contractor' ? 'Fachowiec / firma' : 'Klient indywidualny'],
          ...(profile.data?.role === 'contractor' ? [['map-pin', profile.data.companyAddress], ['navigation', `Obszar: ${profile.data.serviceLocation ?? 'uzupełnij miejscowość'} + 50 km`], ['file-text', `NIP: ${profile.data.nip ?? 'brak'}`]] : []),
        ].map(([icon, value]) => (
          <View key={icon} style={styles.row}>
            <Feather name={icon as 'mail'} size={19} color={colors.mutedForeground} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>{value}</Text>
          </View>
        ))}
      </View>

      {profile.data?.role === 'contractor' && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.editHeading}>
            <Text style={[styles.cardLabel, { color: colors.accent }]}>EDYCJA PROFILU</Text>
            <Pressable onPress={() => setEditing((value) => !value)}>
              <Text style={[styles.editLink, { color: colors.accent }]}>{editing ? 'Anuluj' : 'Edytuj dane'}</Text>
            </Pressable>
          </View>
          <Pressable onPress={chooseProfileImage} disabled={uploadingImage} style={[styles.secondaryButton, { borderColor: colors.border }]}>
            <Feather name="camera" size={18} color={colors.foreground} />
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>{uploadingImage ? 'Przesyłanie…' : 'Dodaj zdjęcie lub logo firmy'}</Text>
          </Pressable>
          {editing && (
            <View style={styles.form}>
              <TextInput value={form.firstName} onChangeText={(firstName) => setForm((current) => ({ ...current, firstName }))} placeholder="Imię" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input }]} />
              <TextInput value={form.lastName} onChangeText={(lastName) => setForm((current) => ({ ...current, lastName }))} placeholder="Nazwisko" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input }]} />
              <TextInput value={form.phone} onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} placeholder="Telefon" keyboardType="phone-pad" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input }]} />
              <TextInput value={form.companyName} onChangeText={(companyName) => setForm((current) => ({ ...current, companyName }))} placeholder="Nazwa firmy" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input }]} />
              <TextInput value={form.companyAddress} onChangeText={(companyAddress) => setForm((current) => ({ ...current, companyAddress }))} placeholder="Adres firmy" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input }]} />
              <TextInput value={form.serviceLocation} onChangeText={(serviceLocation) => setForm((current) => ({ ...current, serviceLocation }))} placeholder="Miejscowość obsługi" autoCapitalize="words" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input }]} />
              <TextInput
                value={form.nip}
                editable={!profile.data.nip}
                onChangeText={(nip) => setForm((current) => ({ ...current, nip: nip.replace(/\D/g, '').slice(0, 10) }))}
                placeholder={profile.data.nip ? undefined : 'NIP — 10 cyfr'}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={10}
                style={[styles.input, profile.data.nip ? styles.disabledInput : undefined, { color: colors.foreground, borderColor: profile.data.nip ? colors.border : colors.input }]}
              />
              <Pressable onPress={saveProfile} disabled={updateProfile.isPending} style={[styles.button, { backgroundColor: colors.primary, opacity: updateProfile.isPending ? 0.65 : 1 }]}>
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{updateProfile.isPending ? 'Zapisywanie…' : 'Zapisz zmiany'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {profile.data?.role === 'contractor' && (
        <View style={[styles.plan, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.planLabel, { color: colors.primary }]}>PLAN DLA FACHOWCA</Text>
          <Text style={[styles.planTitle, { color: colors.background }]}>{subscription.data?.planName ?? 'Profesjonalny'}</Text>
          <Text style={[styles.price, { color: colors.background }]}>{subscription.data?.monthlyPrice ?? '99 zł / mies.'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status === 'active' ? colors.secondary : colors.muted }]}>
            <Text style={[styles.statusText, { color: colors.foreground }]}>{statusLabel}</Text>
          </View>
          {subscription.data?.paymentStatus === 'pending' && <Text style={[styles.warning, { color: colors.primary }]}>PayU przetwarza płatność. Dostęp włączy się automatycznie po potwierdzeniu.</Text>}
          {subscription.data?.renewalReminder && (
            <View testID="subscription-renewal-reminder" style={[styles.reminder, { backgroundColor: colors.primary }]}>
              <View style={styles.reminderHeading}>
                <Feather name="bell" size={18} color={colors.primaryForeground} />
                <Text style={[styles.reminderTitle, { color: colors.primaryForeground }]}>Zbliża się koniec dostępu</Text>
              </View>
              <Text style={[styles.reminderBody, { color: colors.primaryForeground }]}>{subscription.data.renewalReminder.message}</Text>
              <Text style={[styles.reminderDate, { color: colors.primaryForeground }]}>Dostęp do {new Date(subscription.data.renewalReminder.accessExpiresAt).toLocaleDateString('pl-PL')}.</Text>
              <Pressable testID="renew-subscription" onPress={requestActivation} disabled={start.isPending} style={[styles.reminderButton, { backgroundColor: colors.foreground, opacity: start.isPending ? 0.7 : 1 }]}>
                <Text style={[styles.reminderButtonText, { color: colors.background }]}>{start.isPending ? 'Łączymy z PayU…' : 'Odnów przez PayU'}</Text>
                <Feather name="arrow-right" size={16} color={colors.background} />
              </Pressable>
            </View>
          )}
          <Text style={[styles.planBody, { color: colors.muted }]}>Pełny dostęp do danych kontaktowych klientów i nowych zleceń.</Text>
          <Text style={[styles.commitment, { color: colors.background }]}>99,00 zł brutto miesięcznie przez 12 miesięcy. Łączny koszt: 1 188,00 zł brutto.</Text>
          <Text style={[styles.planBody, { color: colors.muted }]}>{subscription.data?.paymentInstructions}</Text>
          <View style={styles.consents}>
            {[
              { key: 'terms', text: 'Akceptuję Regulamin Pakietu Premium, Regulamin Aplikacji oraz Politykę Prywatności.' },
              { key: 'digitalService', text: 'Zgadzam się na rozpoczęcie świadczenia Premium przed upływem 14 dni i przyjmuję do wiadomości utratę prawa odstąpienia po skorzystaniu z funkcji Premium.' },
              { key: 'recurringPayments', text: 'Zgadzam się na zapisanie metody płatności w PayU i cykliczne pobieranie 99,00 zł miesięcznie przez 12 miesięcy.' },
            ].map(({ key, text }) => {
              const consentKey = key as keyof typeof paymentConsents;
              const checked = paymentConsents[consentKey];
              return <Pressable
                key={key}
                testID={`payment-consent-${key}`}
                onPress={() => setPaymentConsents((current) => ({ ...current, [consentKey]: !current[consentKey] }))}
                style={styles.consentRow}
              >
                <Feather name={checked ? 'check-square' : 'square'} size={19} color={checked ? colors.primary : colors.muted} />
                <Text style={[styles.consentText, { color: colors.muted }]}>{text}</Text>
              </Pressable>;
            })}
          </View>
          <View testID="subscription-email-reminders" style={[styles.emailNotice, { backgroundColor: colors.muted }]}>
            <Feather name="mail" size={17} color={colors.primary} />
            <Text style={[styles.emailNoticeText, { color: colors.mutedForeground }]}>
              Kilka dni przed końcem dostępu wyślemy na zweryfikowany e-mail bezpieczne przypomnienie z linkiem do odnowienia przez PayU.
            </Text>
          </View>
          {subscription.data?.accessExpiresAt && status === 'active' && <Text style={[styles.warning, { color: colors.primary }]}>Dostęp aktywny do {new Date(subscription.data.accessExpiresAt).toLocaleDateString('pl-PL')}.</Text>}
          <Pressable onPress={requestActivation} disabled={start.isPending || !paymentConsents.terms || !paymentConsents.digitalService || !paymentConsents.recurringPayments} style={[styles.button, { backgroundColor: colors.primary, opacity: start.isPending || !paymentConsents.terms || !paymentConsents.digitalService || !paymentConsents.recurringPayments ? 0.5 : 1 }]}>
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{start.isPending ? 'Łączymy z PayU…' : 'Kupuję i płacę PayU'}</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        testID="sign-out"
        onPress={async () => {
          queryClient.clear();
          await signOut();
        }}
        style={[styles.signOut, { borderColor: colors.border }]}
      >
        <Feather name="log-out" size={18} color={colors.mutedForeground} />
        <Text style={[styles.signOutText, { color: colors.mutedForeground }]}>Wyloguj się</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 28, paddingBottom: 120, alignItems: 'center', gap: 10 },
  avatar: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 86, height: 86, borderRadius: 28 },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 25 },
  company: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, marginBottom: 12 },
  card: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 16, padding: 17, gap: 15 },
  cardLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5 },
  editHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editLink: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  secondaryButton: { minHeight: 48, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  form: { gap: 10 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontFamily: 'Inter_500Medium', fontSize: 14 },
  disabledInput: { opacity: 0.75 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14 },
  plan: { alignSelf: 'stretch', borderRadius: 20, padding: 20, gap: 8, marginTop: 8 },
  planLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5 },
  planTitle: { fontFamily: 'Inter_700Bold', fontSize: 23 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 2 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  reminder: { borderRadius: 16, padding: 15, gap: 8, marginVertical: 6 },
  reminderHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14 },
  reminderBody: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19 },
  reminderDate: { fontFamily: 'Inter_500Medium', fontSize: 11, opacity: 0.8 },
  reminderButton: { minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  reminderButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  warning: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18 },
  planBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  commitment: { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 19, marginTop: 4 },
  consents: { gap: 12, marginTop: 8 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  consentText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 17 },
  emailNotice: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 12, padding: 12, marginTop: 3 },
  emailNoticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  button: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  signOut: { alignSelf: 'stretch', minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 8 },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

const MOBILE_BILLING_RETURN_URL = 'zlemajstra://billing';
