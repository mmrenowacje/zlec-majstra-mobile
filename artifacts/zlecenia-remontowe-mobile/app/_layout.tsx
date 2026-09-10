import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  getGetMyProfileQueryKey,
  setAuthTokenGetter,
  setBaseUrl,
  useGetMyProfile,
} from '@workspace/api-client-react';
import { ClerkLoaded, ClerkProvider, useAuth, useClerk } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useColors } from '@/hooks/useColors';

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_live_Y2xlcmsuemxlY21hanN0cmEucGwk';
const proxyUrl = __DEV__
  ? undefined
  : process.env.EXPO_PUBLIC_CLERK_PROXY_URL ||
    'https://zlecmajstra.pl/api/__clerk';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const colors = useColors();
  const [tokenReady, setTokenReady] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const profile = useGetMyProfile({
    query: {
      enabled: Boolean(isSignedIn && tokenReady),
      queryKey: getGetMyProfileQueryKey(),
      retry: false,
    },
  });

  useEffect(() => {
    let cancelled = false;
    setTokenReady(false);
    setTokenError('');
    setAuthTokenGetter(null);
    if (!isSignedIn) {
      return;
    }

    getToken({ skipCache: true }).then((token) => {
      if (cancelled) return;
      if (token) {
        setAuthTokenGetter(() => getToken());
        queryClient.removeQueries({ queryKey: getGetMyProfileQueryKey() });
        setTokenReady(true);
      } else {
        setTokenError('Nie udało się przygotować sesji. Zaloguj się ponownie.');
      }
    }).catch(() => {
      if (!cancelled) {
        setTokenError('Nie udało się przygotować sesji. Sprawdź połączenie i spróbuj ponownie.');
      }
    });

    return () => {
      cancelled = true;
      setAuthTokenGetter(null);
      setTokenReady(false);
    };
  }, [isSignedIn]);

  if (!isLoaded) return null;
  if (isSignedIn && !tokenReady) {
    return (
      <SafeAreaView style={[styles.authErrorPage, { backgroundColor: colors.background }]}>
        <View style={styles.authErrorCard}>
          {tokenError ? (
            <>
              <Text style={[styles.authErrorTitle, { color: colors.foreground }]}>
                Nie udało się przygotować logowania
              </Text>
              <Text style={[styles.authErrorText, { color: colors.mutedForeground }]}>
                {tokenError}
              </Text>
              <Pressable
                onPress={() => signOut()}
                style={[styles.authErrorButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.authErrorButtonText, { color: colors.primaryForeground }]}>
                  Wróć do logowania
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.authErrorText, { color: colors.mutedForeground }]}>
                Przygotowuję sesję…
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }
  if (isSignedIn && profile.isPending) {
    return (
      <SafeAreaView style={[styles.authErrorPage, { backgroundColor: colors.background }]}>
        <View style={styles.authErrorCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.authErrorText, { color: colors.mutedForeground }]}>
            Wczytuję konto…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const profileStatus = (profile.error as { status?: number } | null)?.status;
  const hasProfile = Boolean(profile.data);
  const needsProfile = Boolean(isSignedIn && profileStatus === 404);

  if (isSignedIn && profile.isError && !needsProfile) {
    return (
      <SafeAreaView style={[styles.authErrorPage, { backgroundColor: colors.background }]}>
        <View style={styles.authErrorCard}>
          <Text style={[styles.authErrorTitle, { color: colors.foreground }]}>
            Nie udało się wczytać konta
          </Text>
          <Text style={[styles.authErrorText, { color: colors.mutedForeground }]}>
            Sprawdź połączenie i spróbuj ponownie.
          </Text>
          <Pressable
            onPress={() => profile.refetch()}
            style={[styles.authErrorButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.authErrorButtonText, { color: colors.primaryForeground }]}>
              Spróbuj ponownie
            </Text>
          </Pressable>
          <Pressable onPress={() => signOut()} style={styles.authErrorLink}>
            <Text style={[styles.authErrorLinkText, { color: colors.mutedForeground }]}>
              Wyloguj się
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="billing" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ title: 'Regulamin aplikacji', headerBackTitle: 'Wróć' }} />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ presentation: 'modal', headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(isSignedIn && hasProfile)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="request/[id]" options={{ title: 'Szczegóły zlecenia', headerBackTitle: 'Wróć' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  authErrorPage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  authErrorCard: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 12 },
  authErrorTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, textAlign: 'center' },
  authErrorText: { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center' },
  authErrorButton: { minHeight: 52, alignSelf: 'stretch', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  authErrorButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  authErrorLink: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  authErrorLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={publishableKey ?? ''}
          tokenCache={tokenCache}
          proxyUrl={proxyUrl}
          __experimental_disableNativeClientSync
        >
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
