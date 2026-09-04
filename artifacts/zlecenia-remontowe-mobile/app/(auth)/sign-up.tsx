import { Feather } from '@expo/vector-icons';
import { useSignUp } from '@clerk/expo';
import { Link, router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { savePendingProfile } from '@/lib/pending-profile';

type Role = 'customer' | 'contractor';

function messageFor(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Spróbuj ponownie.';
  const candidate = error as { message?: string; longMessage?: string };
  return candidate.longMessage ?? candidate.message ?? 'Spróbuj ponownie.';
}

export default function SignUpScreen() {
  const colors = useColors();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [nip, setNip] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const isPending = fetchStatus === 'fetching';
  const verifying = codeSent;

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || phone.trim().length < 7) {
      setError('Podaj imię, nazwisko i poprawny numer telefonu.');
      return;
    }
    if (!acceptedTerms) {
      setError('Zaakceptuj Regulamin aplikacji, aby założyć konto.');
      return;
    }
    if (
      role === 'contractor' &&
      (!companyName.trim() || !companyAddress.trim() || !serviceLocation.trim() || !/^\d{10}$/.test(nip))
    ) {
      setError('Podaj nazwę firmy, adres firmy, miejscowość obsługi i poprawny 10-cyfrowy NIP.');
      return;
    }
    if (password.length < 8) {
      setError('Hasło musi mieć minimum 8 znaków.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Hasło musi zawierać co najmniej jedną wielką literę.');
      return;
    }
    try {
      setError('');
      const result = await signUp.password({
        emailAddress: emailAddress.trim(),
        password,
      });
      if (result.error) {
        setError(messageFor(result.error));
        return;
      }
      const verification = await signUp.verifications.sendEmailCode();
      if (verification.error) {
        setError(messageFor(verification.error));
        return;
      }
      setCodeSent(true);
    } catch (submitError) {
      setError(messageFor(submitError));
    }
  };

  const verify = async () => {
    try {
      setError('');
      const result = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (result.error) {
        setError(messageFor(result.error));
        return;
      }
      if (signUp.status !== 'complete') {
        setError('Kod jest poprawny, ale rejestracja nie została jeszcze ukończona.');
        return;
      }
      const createdUserId = signUp.createdUserId;
      if (!createdUserId) {
        throw new Error('Nie udało się ustalić identyfikatora nowego konta.');
      }
      await savePendingProfile(createdUserId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        phone: phone.trim(),
        companyName: role === 'contractor' ? companyName.trim() : undefined,
        companyAddress: role === 'contractor' ? companyAddress.trim() : undefined,
        serviceLocation: role === 'contractor' ? serviceLocation.trim() : undefined,
        nip: role === 'contractor' ? nip : undefined,
      });
      const finalized = await signUp.finalize();
      if (finalized.error) {
        setError(messageFor(finalized.error));
        return;
      }
      router.replace('/(onboarding)/profile');
    } catch (profileError) {
      setError(messageFor(profileError));
    }
  };

  const fieldError =
    errors.fields.emailAddress?.message ??
    errors.fields.password?.message ??
    errors.fields.code?.message;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      bottomOffset={72}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.brandMark, { backgroundColor: colors.foreground }]}>
        <Feather name="user-plus" size={24} color={colors.primary} />
      </View>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>ZLEĆ MAJSTRA</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {verifying ? 'Sprawdź email' : 'Załóż konto'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {verifying
          ? `Wysłaliśmy 6-cyfrowy kod na ${emailAddress.trim()}.`
          : 'Uzupełnij dane, aby od razu korzystać z platformy.'}
      </Text>

      {verifying ? (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Kod z emaila</Text>
          <TextInput
            testID="sign-up-code"
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            style={[styles.input, styles.codeInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
          {!!(error || fieldError) && (
            <Text style={[styles.error, { color: colors.destructive }]}>{error || fieldError}</Text>
          )}
          <Pressable
            testID="sign-up-verify"
            onPress={verify}
            disabled={code.trim().length < 4 || isPending}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: code.trim().length < 4 || isPending || pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {isPending ? 'Weryfikuję…' : 'Potwierdź email'}
            </Text>
          </Pressable>
          <Pressable
            testID="sign-up-resend"
            onPress={async () => {
              const result = await signUp.verifications.sendEmailCode();
              if (result.error) setError(messageFor(result.error));
              else setError('Wysłaliśmy nowy kod.');
            }}
            disabled={isPending}
            style={styles.secondaryButton}
          >
            <Text style={[styles.link, { color: colors.accent }]}>Wyślij kod ponownie</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.nameRow}>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.foreground }]}>Imię</Text>
              <TextInput
                testID="sign-up-first-name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jan"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.foreground }]}>Nazwisko</Text>
              <TextInput
                testID="sign-up-last-name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Kowalski"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
              />
            </View>
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Kim jesteś?</Text>
          <View style={styles.roleRow}>
            {([
              ['customer', 'Klient'],
              ['contractor', 'Fachowiec / firma'],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                testID={`sign-up-role-${value}`}
                onPress={() => setRole(value)}
                style={[
                  styles.roleButton,
                  { backgroundColor: role === value ? colors.foreground : colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: role === value ? colors.background : colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Telefon</Text>
          <TextInput
            testID="sign-up-phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+48 500 600 700"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            autoComplete="tel"
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
          {!!phone.trim() && phone.trim().length < 7 && (
            <Text style={[styles.fieldHint, { color: colors.destructive }]}>
              Numer telefonu musi mieć co najmniej 7 znaków.
            </Text>
          )}
          {role === 'contractor' && (
            <View style={[styles.companyFields, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.companyTitle, { color: colors.foreground }]}>Dane firmy</Text>
              <TextInput
                testID="sign-up-company-name"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Nazwa firmy"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
              />
              <TextInput
                testID="sign-up-company-address"
                value={companyAddress}
                onChangeText={setCompanyAddress}
                placeholder="Adres firmy"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
              />
              <TextInput
                testID="sign-up-service-location"
                value={serviceLocation}
                onChangeText={setServiceLocation}
                placeholder="Miejscowość obsługi, np. Warszawa"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
              />
              <TextInput
                testID="sign-up-nip"
                value={nip}
                onChangeText={(value) => setNip(value.replace(/\D/g, '').slice(0, 10))}
                placeholder="NIP — 10 cyfr"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={10}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
              />
            </View>
          )}
          <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
          <TextInput
            testID="sign-up-email"
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="ty@przyklad.pl"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Hasło</Text>
          <TextInput
            testID="sign-up-password"
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 8 znaków"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoComplete="new-password"
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            Minimum 8 znaków, w tym co najmniej 1 wielka litera.
          </Text>
          {!!(error || fieldError) && (
            <Text style={[styles.error, { color: colors.destructive }]}>{error || fieldError}</Text>
          )}
          <Pressable
            testID="registration-terms"
            onPress={() => setAcceptedTerms((current) => !current)}
            style={styles.termsRow}
          >
            <Feather name={acceptedTerms ? 'check-square' : 'square'} size={20} color={acceptedTerms ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
              Akceptuję <Link href="/terms" asChild><Text style={[styles.link, { color: colors.accent }]}>Regulamin aplikacji</Text></Link> i zobowiązuję się go przestrzegać.
            </Text>
          </Pressable>
          <Pressable
            testID="sign-up-submit"
            onPress={submit}
            disabled={!firstName.trim() || !lastName.trim() || !phone.trim() || !emailAddress.trim() || !password || !acceptedTerms || (role === 'contractor' && (!companyName.trim() || !companyAddress.trim() || !serviceLocation.trim() || nip.length !== 10)) || isPending}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: !firstName.trim() || !lastName.trim() || !phone.trim() || !emailAddress.trim() || !password || !acceptedTerms || (role === 'contractor' && (!companyName.trim() || !companyAddress.trim() || !serviceLocation.trim() || nip.length !== 10)) || isPending || pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {isPending ? 'Tworzę konto…' : 'Utwórz konto'}
            </Text>
          </Pressable>
        </>
      )}

      {!verifying && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Masz już konto?</Text>
          <Link href={'/(auth)/sign-in' as Href} asChild>
            <Pressable>
              <Text style={[styles.link, { color: colors.accent }]}>Zaloguj się</Text>
            </Pressable>
          </Link>
        </View>
      )}
      <View nativeID="clerk-captcha" />
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, paddingTop: 44, paddingBottom: 40, gap: 8 },
  brandMark: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginTop: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, marginTop: 2 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginBottom: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 5, marginBottom: 2 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontFamily: 'Inter_500Medium', fontSize: 15 },
  codeInput: { textAlign: 'center', fontSize: 25, letterSpacing: 8, fontFamily: 'Inter_700Bold' },
  nameRow: { flexDirection: 'row', gap: 9 },
  halfField: { flex: 1 },
  roleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  roleButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10 },
  companyFields: { gap: 9, borderWidth: 1, borderRadius: 18, padding: 12, marginTop: 6 },
  companyTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 1 },
  error: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19, marginTop: 3 },
  fieldHint: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  primaryButton: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  secondaryButton: { alignItems: 'center', padding: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12, flexWrap: 'wrap' },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  termsText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  link: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});