import { useAuth } from '@clerk/expo';
import {
  getGetMyProfileQueryKey,
  useGetMyProfile,
} from '@workspace/api-client-react';
import { Redirect } from 'expo-router';

export default function IndexRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const profile = useGetMyProfile({
    query: {
      enabled: Boolean(isSignedIn),
      queryKey: getGetMyProfileQueryKey(),
      retry: false,
    },
  });

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (profile.data) return <Redirect href="/(tabs)" />;

  const profileStatus = (profile.error as { status?: number } | null)?.status;
  if (profileStatus === 404) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return null;
}