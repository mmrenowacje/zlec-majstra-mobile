import { Feather } from '@expo/vector-icons';
import { useSignIn } from '@clerk/expo';
import { Link, router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

function messageFor(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Spróbuj ponownie.';
  const candidate = error as {
    message?: string;
    longMessage?: string;
    errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  };
  const firstError = candidate.errors?.[0];
  if (firstError?.code === 'form_identifier_not_found') {
    return 'Nie znaleziono konta w środowisku Dev. Jeśli konto zostało utworzone w opublikowanej aplikacji, trzeba utworzyć je osobno w Expo Go.';
  }
  return firstError?.longMessage
    ?? firstError?.message
    ?? candidate.longMessage
    ?? candidate.message
    ?? 'Spróbuj ponownie.';
}

type VerificationMethod = 'email_code' | 'totp';

export default function SignInScreen() {
  const colors = useColors();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const isPending = fetchStatus === 'fetching';

  const finalize = async () => {
    const finalized = await signIn.finalize();
    if (finalized.error) {
      setError(messageFor(finalized.error));
      return;
    }
    router.replace('/');
  };

  const beginAdditionalVerification = async () => {
    const emailCodeAvailable = signIn.supportedSecondFactors.some(
      (factor) => factor.strategy === 'email_code',
    );
    if (emailCodeAvailable) {
      const result = await signIn.mfa.sendEmailCode();
      if (result.error) {
        setError(messageFor(result.error));
        return;
      }
      setVerificationMethod('email_code');
      setNotice(`Wysłaliśmy kod weryfikacyjny na ${emailAddress.trim()}.`);
      return;
    }

    const totpAvailable = signIn.supportedSecondFactors.some(
      (factor) => factor.strategy === 'totp',
    );
    if (totpAvailable) {
      setVerificationMethod('totp');
      setNotice('Wpisz kod z aplikacji uwierzytelniającej.');
      return;
    }

    setError('To konto wymaga metody weryfikacji, której aplikacja jeszcze nie obsługuje.');
  };

  const submit = async () => {
    try {
      setError('');
      setNotice('');
      const normalizedEmail = emailAddress.trim().toLowerCase();
      const result = await signIn.password({
        emailAddress: normalizedEmail,
        password,
      });

      if (result.error) {
        setError(messageFor(result.error));
        return;
      }

      if (signIn.status === 'complete') {
        await finalize();
        return;
      }

      if (
        signIn.status === 'needs_second_factor'
        || signIn.status === 'needs_client_trust'
      ) {
        await beginAdditionalVerification();
        return;
      }

      setError(`Nie udało się dokończyć logowania (status: ${signIn.status}).`);
    } catch (submitError) {
      setError(messageFor(submitError));
    }
  };

  const verify = async () => {
    if (!verificationMethod) return;

    try {
      setError('');
      const result = verificationMethod === 'email_code'
        ? await signIn.mfa.verifyEmailCode({ code: code.trim() })
        : await signIn.mfa.verifyTOTP({ code: code.trim() });

      if (result.error) {
        setError(messageFor(result.error));
        return;
      }
      if (signIn.status !== 'complete') {
        setError(`Weryfikacja nie została ukończona (status: ${signIn.status}).`);
        return;
      }
      await finalize();
    } catch (verificationError) {
      setError(messageFor(verificationError));
    }
  };

  const resendEmailCode = async () => {
    setError('');
    const result = await signIn.mfa.sendEmailCode();
    if (result.error) {
      setError(messageFor(result.error));
      return;
    }
    setNotice('Wysłaliśmy nowy kod weryfikacyjny.');
  };

  const resetVerification = async () => {
    await signIn.reset();
    setVerificationMethod(null);
    setCode('');
    setNotice('');
    setError('');
  };

  const fieldError =
    errors.fields.identifier?.message ?? errors.fields.password?.message;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      bottomOffset={72}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.brandMark, { backgroundColor: colors.foreground }]}>
        <Feather name={verificationMethod ? 'shield' : 'tool'} size={24} color={colors.primary} />
      </View>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>ZLEĆ MAJSTRA</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {verificationMethod ? 'Potwierdź logowanie' : 'Witaj ponownie'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {verificationMethod
          ? notice
          : 'Zaloguj się, aby przeglądać zlecenia i zarządzać swoim kontem.'}
      </Text>

      {verificationMethod ? (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {verificationMethod === 'email_code' ? 'Kod z emaila' : 'Kod uwierzytelniający'}
          </Text>
          <TextInput
            testID="sign-in-verification-code"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            placeholder="000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            style={[styles.input, styles.codeInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
          {!!(error || errors.fields.code?.message) && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {error || errors.fields.code?.message}
            </Text>
          )}
          <Pressable
            testID="sign-in-verify"
            onPress={verify}
            disabled={code.trim().length < 6 || isPending}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: code.trim().length < 6 || isPending || pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {isPending ? 'Weryfikuję…' : 'Potwierdź logowanie'}
            </Text>
          </Pressable>
          {verificationMethod === 'email_code' && (
            <Pressable
              testID="sign-in-resend-code"
              onPress={resendEmailCode}
              disabled={isPending}
              style={styles.secondaryButton}
            >
              <Text style={[styles.link, { color: colors.accent }]}>Wyślij kod ponownie</Text>
            </Pressable>
          )}
          <Pressable onPress={resetVerification} disabled={isPending} style={styles.secondaryButton}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Wróć do logowania</Text>
          </Pressable>
        </>
      ) : (
        <>
      <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
      <TextInput
        testID="sign-in-email"
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
        testID="sign-in-password"
        value={password}
        onChangeText={setPassword}
        placeholder="Wpisz hasło"
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry
        autoComplete="password"
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
      />

      {!!(error || fieldError) && (
        <Text style={[styles.error, { color: colors.destructive }]}>{error || fieldError}</Text>
      )}
      <Pressable
        testID="sign-in-submit"
        onPress={submit}
        disabled={!emailAddress.trim() || !password || isPending}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary, opacity: !emailAddress.trim() || !password || isPending || pressed ? 0.65 : 1 },
        ]}
      >
        <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
          {isPending ? 'Logowanie…' : 'Zaloguj się'}
        </Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Nie masz jeszcze konta?</Text>
        <Link href={'/(auth)/sign-up' as Href} asChild>
          <Pressable>
            <Text style={[styles.link, { color: colors.accent }]}>Załóż konto</Text>
          </Pressable>
        </Link>
      </View>
        </>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, paddingTop: 64, paddingBottom: 40, justifyContent: 'center', gap: 10 },
  brandMark: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginTop: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, marginTop: 2 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 6 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, fontFamily: 'Inter_500Medium', fontSize: 15 },
  codeInput: { textAlign: 'center', fontSize: 25, letterSpacing: 8, fontFamily: 'Inter_700Bold' },
  error: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19, marginTop: 2 },
  primaryButton: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 18, flexWrap: 'wrap' },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  link: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});