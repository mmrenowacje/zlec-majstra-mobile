import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback } from 'react';
import {
  getGetDashboardSummaryQueryKey,
  getGetMyProfileQueryKey,
  getListRequestsQueryKey,
  useGetDashboardSummary,
  useGetMyProfile,
  useListRequests,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { RequestCard } from '@/components/RequestCard';

export default function DashboardScreen() {
  const colors = useColors();
  const profile = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      refetchOnMount: 'always',
    },
  });
  const summary = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      refetchOnMount: 'always',
    },
  });
  const openRequestParams = { status: 'open' as const };
  const requests = useListRequests(
    openRequestParams,
    {
      query: {
        queryKey: getListRequestsQueryKey(openRequestParams),
        refetchOnMount: 'always',
      },
    },
  );
  const refreshing = profile.isRefetching || summary.isRefetching || requests.isRefetching;
  const refresh = () => Promise.all([profile.refetch(), summary.refetch(), requests.refetch()]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [profile.refetch, summary.refetch, requests.refetch]),
  );

  if (profile.isLoading || summary.isLoading || requests.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webInset]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>DZIEŃ DOBRY</Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {profile.data?.firstName ?? 'Fachowcu'}, co dziś robimy?
          </Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.avatarText, { color: colors.background }]}>
            {(profile.data?.firstName?.[0] ?? 'Z').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.foreground }]}>
        <View style={styles.heroIcon}><Feather name="tool" size={22} color={colors.primary} /></View>
        <Text style={[styles.heroLabel, { color: colors.primary }]}>NOWE MOŻLIWOŚCI</Text>
        <Text style={[styles.heroTitle, { color: colors.background }]}>
          {summary.data?.openRequests ?? 0} zleceń czeka na dobrego fachowca
        </Text>
        <Text style={[styles.heroBody, { color: colors.muted }]}>
          Przeglądaj prace w swojej okolicy i wybierz te, które pasują do Twojego doświadczenia.
        </Text>
      </View>

      <View style={styles.stats}>
        {[
          ['Otwarte', summary.data?.openRequests ?? 0],
          ['Nowe w tygodniu', summary.data?.newThisWeek ?? 0],
          ['Odblokowane', summary.data?.unlockedContacts ?? 0],
        ].map(([label, value]) => (
          <View key={String(label)} style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Najnowsze zlecenia</Text>
        <Feather name="arrow-right" size={20} color={colors.foreground} onPress={() => router.push('/requests')} />
      </View>
      <View style={styles.list}>
        {(requests.data ?? []).slice(0, 3).map((item) => (
          <RequestCard key={item.id} request={item} onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(item.id) } })} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120, gap: 22 },
  webInset: { paddingTop: 84, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.7, marginBottom: 5 },
  heading: { maxWidth: 275, fontFamily: 'Inter_700Bold', fontSize: 27, lineHeight: 32 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { borderRadius: 20, padding: 22, gap: 9 },
  heroIcon: { marginBottom: 8 },
  heroLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 25, lineHeight: 31 },
  heroBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  stats: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, minHeight: 90, borderWidth: 1, borderRadius: 14, padding: 12, justifyContent: 'space-between' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 23 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 21 },
  list: { gap: 12 },
});