import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  getGetNotificationsQueryKey,
  useGetNotifications,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function MessagesScreen() {
  const colors = useColors();
  const notifications = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      refetchInterval: 10000,
      refetchOnMount: 'always',
      retry: false,
    },
  });

  useFocusEffect(
    useCallback(() => {
      void notifications.refetch();
    }, [notifications.refetch]),
  );

  const items = notifications.data?.notifications ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.conversationId}-${item.requestId}`}
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webInset]}
        refreshControl={
          <RefreshControl
            refreshing={notifications.isRefetching}
            onRefresh={notifications.refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>KOMUNIKATOR</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Wiadomości</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Tutaj zobaczysz, gdy zleceniodawca lub fachowiec skontaktuje się z Tobą.
            </Text>
            {notifications.data && notifications.data.unreadConversations > 0 ? (
              <View style={[styles.countCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="bell" size={17} color={colors.secondaryForeground} />
                <Text style={[styles.countText, { color: colors.secondaryForeground }]}>
                  {notifications.data.unreadConversations} {notifications.data.unreadConversations === 1 ? 'nowa rozmowa' : 'nowe rozmowy'}
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(item.requestId), conversationId: String(item.conversationId) } })}
            style={({ pressed }) => [
              styles.messageCard,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.78 : 1 },
            ]}
            testID={`message-notification-${item.conversationId}`}
          >
            <View style={[styles.messageIcon, { backgroundColor: colors.primary + '1A' }]}>
              <Feather name="message-circle" size={20} color={colors.primary} />
            </View>
            <View style={styles.messageCopy}>
              <View style={styles.messageHeading}>
                <Text style={[styles.messageTitle, { color: colors.foreground }]}>{item.title}</Text>
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.messageBody, { color: colors.mutedForeground }]}>{item.body}</Text>
              <Text style={[styles.messageDate, { color: colors.mutedForeground }]}>
                {new Date(item.createdAt).toLocaleString('pl-PL')}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
        ListEmptyComponent={
          notifications.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="message-circle" size={24} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Brak nowych wiadomości</Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                Gdy ktoś napisze w sprawie zlecenia, powiadomienie pojawi się tutaj.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, paddingBottom: 120 },
  webInset: { paddingTop: 82, paddingBottom: 110 },
  header: { gap: 8, marginBottom: 18 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  countCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 7 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  messageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  messageIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  messageCopy: { flex: 1, gap: 4 },
  messageHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  messageTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  messageBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  messageDate: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 2 },
  loader: { marginTop: 60 },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 24, paddingVertical: 42, marginTop: 20 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  emptyBody: { fontFamily: 'Inter_400Regular', textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 7 },
});