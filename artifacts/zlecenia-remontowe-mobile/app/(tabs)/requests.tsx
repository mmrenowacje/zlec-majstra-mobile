import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  getGetMyProfileQueryKey,
  getListRequestsQueryKey,
  useListRequests,
  useGetMyProfile,
  requestCategoryFilterOptions,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { RequestCard } from '@/components/RequestCard';

export default function RequestsScreen() {
  const colors = useColors();
  const profile = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      refetchOnMount: 'always',
    },
  });
  const isCustomer = profile.data?.role === 'customer';
  const isContractor = profile.data?.role === 'contractor';

  const [categoryFilter, setCategoryFilter] = useState<(typeof requestCategoryFilterOptions)[number]['value']>('all');
  const [statusFilter, setStatusFilter] = useState<'open' | 'completed'>('open');

  const requestParams = {
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    status: statusFilter,
    mine: isCustomer || (isContractor && statusFilter === 'completed') ? true : undefined,
  };

  const query = useListRequests(
    requestParams,
    {
      query: {
        queryKey: getListRequestsQueryKey(requestParams),
        refetchOnMount: 'always',
      },
    },
  );

  useFocusEffect(
    useCallback(() => {
      void profile.refetch();
      void query.refetch();
    }, [profile.refetch, query.refetch]),
  );

  const headerTitle = isCustomer ? 'Twoje zlecenia' : 'Zlecenia w okolicy';
  const headerSubtitle = isCustomer 
    ? 'Zarządzaj swoimi zleceniami i wystawiaj opinie.' 
    : 'Przeglądaj aktywne zlecenia i swoje zakończone realizacje.';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <RequestCard request={item} onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(item.id) } })} />
        )}
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webInset]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>{headerTitle}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{headerSubtitle}</Text>
            
            <View style={[styles.statusTabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
                testID="requests-status-open"
                onPress={() => setStatusFilter('open')}
                style={[styles.statusTab, statusFilter === 'open' && { backgroundColor: colors.foreground }]}
              >
                <Text style={[styles.statusTabText, statusFilter === 'open' ? { color: colors.background } : { color: colors.foreground }]}>Otwarte</Text>
              </Pressable>
              <Pressable
                testID="requests-status-completed"
                onPress={() => setStatusFilter('completed')}
                style={[styles.statusTab, statusFilter === 'completed' && { backgroundColor: colors.foreground }]}
              >
                <Text style={[styles.statusTabText, statusFilter === 'completed' ? { color: colors.background } : { color: colors.foreground }]}>Zakończone</Text>
              </Pressable>
            </View>

            <FlatList
              horizontal
              data={requestCategoryFilterOptions}
              keyExtractor={(item) => item.value}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setCategoryFilter(item.value)}
                  style={[styles.filter, { backgroundColor: categoryFilter === item.value ? colors.foreground : colors.card, borderColor: colors.border }]}
                >
                  <Text style={{ color: categoryFilter === item.value ? colors.background : colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        }
        ListEmptyComponent={query.isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.empty, { color: colors.mutedForeground }]}>Brak zleceń w tej kategorii.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, paddingBottom: 120 },
  webInset: { paddingTop: 82, paddingBottom: 110 },
  header: { gap: 10, marginBottom: 18 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  statusTabs: { flexDirection: 'row', padding: 4, borderRadius: 12, borderWidth: 1, marginTop: 4, marginBottom: 8 },
  statusTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  statusTabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  filters: { gap: 8, paddingVertical: 8 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  empty: { textAlign: 'center', marginTop: 80, fontFamily: 'Inter_500Medium' },
});