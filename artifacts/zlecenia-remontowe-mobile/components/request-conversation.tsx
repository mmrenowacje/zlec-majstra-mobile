import { Feather, Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getGetRequestConversationQueryKey,
  getGetRequestConversationByIdQueryKey,
  getGetNotificationsQueryKey,
  getGetRequestQueryKey,
  getGetContractorProfileQueryKey,
  getListRequestConversationsQueryKey,
  type Profile,
  resolveApiUrl,
  useGetRequestConversationById,
  useGetContractorProfile,
  useGetRequestConversation,
  useListRequestConversations,
  useSendConversationMessage,
  useSendConversationMessageById,
  useShareRequestContactById,
  useStartRequestConversation,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type RequestConversationProps = {
  requestId: number;
  profile: Profile;
  canStartConversation: boolean;
  initialConversationId?: number | null;
};

export function RequestConversation({
  requestId,
  profile,
  canStartConversation,
  initialConversationId = null,
}: RequestConversationProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const contractorQueryKey = getGetRequestConversationQueryKey(requestId);
  const customerListQueryKey = getListRequestConversationsQueryKey(requestId);
  const contractorConversation = useGetRequestConversation(requestId, {
    query: {
      queryKey: contractorQueryKey,
      retry: false,
      refetchInterval: 3000,
      enabled: Number.isFinite(requestId) && profile.role === 'contractor',
    },
  });
  const customerConversations = useListRequestConversations(requestId, {
    query: {
      queryKey: customerListQueryKey,
      retry: false,
      refetchInterval: 3000,
      enabled: Number.isFinite(requestId) && profile.role === 'customer',
    },
  });
  useEffect(() => {
    if (profile.role !== 'customer' || !customerConversations.data?.length) return;
    if (
      initialConversationId !== null &&
      customerConversations.data.some((item) => item.id === initialConversationId) &&
      selectedConversationId !== initialConversationId
    ) {
      setSelectedConversationId(initialConversationId);
      return;
    }
    const selectionStillExists = customerConversations.data.some(
      (item) => item.id === selectedConversationId,
    );
    if (!selectionStillExists) setSelectedConversationId(customerConversations.data[0].id);
  }, [customerConversations.data, initialConversationId, profile.role, selectedConversationId]);
  const customerQueryKey = getGetRequestConversationByIdQueryKey(
    requestId,
    selectedConversationId ?? 0,
  );
  const customerConversation = useGetRequestConversationById(
    requestId,
    selectedConversationId ?? 0,
    {
      query: {
        queryKey: customerQueryKey,
        retry: false,
        refetchInterval: 3000,
        enabled:
          Number.isFinite(requestId) &&
          profile.role === 'customer' &&
          selectedConversationId !== null,
      },
    },
  );
  const conversation =
    profile.role === 'customer' ? customerConversation : contractorConversation;
  const contractorProfile = useGetContractorProfile(conversation.data?.contractorId ?? '', {
    query: {
      queryKey: getGetContractorProfileQueryKey(conversation.data?.contractorId ?? ''),
      enabled: profile.role === 'customer' && Boolean(conversation.data?.contractorId),
      retry: false,
    },
  });
  const start = useStartRequestConversation();
  const send = useSendConversationMessage();
  const sendById = useSendConversationMessageById();
  const shareById = useShareRequestContactById();
  const refreshedNotificationsFor = useRef<number | null>(null);
  useEffect(() => {
    if (conversation.data?.id && refreshedNotificationsFor.current !== conversation.data.id) {
      refreshedNotificationsFor.current = conversation.data.id;
      void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    }
  }, [conversation.data?.id, queryClient]);
  useEffect(() => {
    if (profile.role === 'contractor' && conversation.data?.customerContactShared) {
      void queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
    }
  }, [conversation.data?.customerContactShared, profile.role, queryClient, requestId]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: contractorQueryKey });
    queryClient.invalidateQueries({ queryKey: customerListQueryKey });
    if (selectedConversationId !== null) {
      queryClient.invalidateQueries({ queryKey: customerQueryKey });
    }
  };
  const updateContractorConversation = (result: Parameters<typeof queryClient.setQueryData>[1]) => {
    queryClient.setQueryData(contractorQueryKey, result);
  };

  if (!conversation.data) {
    if (profile.role !== 'contractor') return null;

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="message-circle" size={26} color={colors.primary} />
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Porozmawiaj ze zleceniodawcą
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Rozmowa nie ujawnia telefonu ani e-maila. Zleceniodawca udostępni je dopiero,
          gdy po rozmowie zdecyduje się kontynuować kontakt.
        </Text>
        <Pressable
          disabled={!canStartConversation || start.isPending}
          onPress={() => {
            setNotice('');
            start.mutate(
              { id: requestId },
              {
                onSuccess: updateContractorConversation,
                onError: () =>
                  setNotice(
                    'Rozmowę może rozpocząć fachowiec z aktywnym, opłaconym abonamentem.',
                  ),
              },
            );
          }}
          style={[
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              opacity: canStartConversation && !start.isPending ? 1 : 0.55,
            },
          ]}
        >
          {start.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
              Otwórz komunikator
            </Text>
          )}
        </Pressable>
        {!canStartConversation && (
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Aktywuj abonament Profesjonalista, aby rozpocząć rozmowę.
          </Text>
        )}
        {notice ? <Text style={[styles.error, { color: colors.destructive }]}>{notice}</Text> : null}
      </View>
    );
  }

  const data = conversation.data;
  const contractorHasMessaged = data.messages.some(
    (message) => message.senderId === data.contractorId,
  );
  const sending = send.isPending || sendById.isPending;
  const submit = () => {
    const message = body.trim();
    if (!message || sending) return;

    setNotice('');
    const options = {
      onSuccess: () => {
        setBody('');
        refresh();
      },
      onError: () => setNotice('Nie udało się wysłać wiadomości.'),
    };
    if (profile.role === 'customer' && selectedConversationId !== null) {
      sendById.mutate(
        { id: requestId, conversationId: selectedConversationId, data: { body: message } },
        options,
      );
    } else {
      send.mutate({ id: requestId, data: { body: message } }, options);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Feather name="message-circle" size={22} color={colors.foreground} />
          <Text style={[styles.heading, { color: colors.foreground }]}>Rozmowa o zleceniu</Text>
        </View>
        {data.customerContactShared ? (
          <View style={styles.status}>
            <Feather name="check-circle" size={16} color={colors.secondaryForeground} />
            <Text style={[styles.statusText, { color: colors.secondaryForeground }]}>
              Kontakt udostępniony
            </Text>
          </View>
        ) : (
          <Feather name="lock" size={18} color={colors.mutedForeground} />
        )}
      </View>
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>
        Telefon i e-mail są chronione do decyzji zleceniodawcy.
      </Text>
      {profile.role === 'customer' && (customerConversations.data?.length ?? 0) > 1 && (
        <View style={styles.threadSelector}>
          {customerConversations.data?.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedConversationId(item.id)}
              style={[
                styles.threadButton,
                {
                  backgroundColor:
                    item.id === selectedConversationId ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.threadButtonText,
                  {
                    color:
                      item.id === selectedConversationId
                        ? colors.primaryForeground
                        : colors.secondaryForeground,
                  },
                ]}
              >
                Fachowiec {index + 1}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {profile.role === 'customer' && contractorHasMessaged && (
        <View style={[styles.reviewPanel, { backgroundColor: colors.primary + '0D', borderBottomColor: colors.border }]}>
          <View style={styles.reviewHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reviewTitle, { color: colors.foreground }]}>Oceny fachowca: {data.contractorName}</Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>Sprawdź wcześniejsze opinie przed podjęciem decyzji.</Text>
            </View>
            <View style={[styles.ratingPill, { backgroundColor: colors.card }]}>
              <Feather name="star" size={14} color={colors.primary} />
              <Text style={[styles.ratingText, { color: colors.foreground }]}>
                {data.contractorReviewCount > 0
                  ? `${data.contractorAverageRating.toFixed(1)} (${data.contractorReviewCount})`
                  : 'Brak ocen'}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => setProfileOpen(value => !value)} style={[styles.profileButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="user" size={16} color={colors.foreground} />
            <Text style={[styles.buttonText, { color: colors.foreground }]}>{profileOpen ? 'Ukryj profil fachowca' : 'Obejrzyj profil fachowca'}</Text>
          </Pressable>
          {profileOpen && contractorProfile.data ? (
            <View style={[styles.contractorProfile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {contractorProfile.data.profileImageUrl ? <Image source={{ uri: contractorProfile.data.profileImageUrl }} style={styles.avatar} /> : null}
              <Text style={[styles.reviewTitle, { color: colors.foreground }]}>{contractorProfile.data.companyName || `${contractorProfile.data.firstName} ${contractorProfile.data.lastName}`}</Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>{contractorProfile.data.companyAddress} · obszar {contractorProfile.data.serviceLocation}</Text>
              <Text style={[styles.helper, { color: colors.foreground }]}>NIP: {contractorProfile.data.nip}{contractorProfile.data.verified ? ' · konto zweryfikowane' : ''}</Text>
              {contractorProfile.data.completedProjects.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>{contractorProfile.data.completedProjects.slice(0, 8).map(photo => <Image key={photo.id} source={{ uri: resolveApiUrl(photo.imageUrl) }} style={{ width: 150, height: 110, borderRadius: 10 }} />)}</ScrollView> : null}
            </View>
          ) : null}
          {data.contractorReviews.map((review) => (
            <View key={review.id} style={[styles.reviewItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.reviewMeta}>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name={star <= review.rating ? 'star' : 'star-outline'} size={13} color={star <= review.rating ? colors.primary : colors.mutedForeground} />
                  ))}
                </View>
                <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
                  {new Date(review.createdAt).toLocaleDateString('pl-PL')}
                </Text>
              </View>
              <Text style={[styles.reviewBody, { color: colors.foreground }]}>{review.body}</Text>
              {review.photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
                  {review.photos.map((photo) => <Image key={photo.id} source={{ uri: resolveApiUrl(photo.imageUrl) }} style={{ width: 150, height: 110, borderRadius: 10 }} />)}
                </ScrollView>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={[styles.messages, { backgroundColor: colors.muted }]}>
        {data.messages.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Napisz pierwszą wiadomość i ustal szczegóły.
          </Text>
        ) : (
          data.messages.map((message) => {
            const isMine = message.senderId === profile.id;
            return (
              <View
                key={message.id}
                style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}
              >
                <View
                  style={[
                    styles.message,
                    {
                      backgroundColor: isMine ? colors.primary : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageBody,
                      { color: isMine ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {message.body}
                  </Text>
                  <Text
                    style={[
                      styles.timestamp,
                      { color: isMine ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {new Date(message.createdAt).toLocaleString('pl-PL')}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {profile.role === 'contractor' && data.customerContactShared && (
        <View style={[styles.sharedContact, { backgroundColor: colors.secondary }]}>
          {data.customerPhone ? (
            <View style={styles.contactLine}>
              <Feather name="phone" size={16} color={colors.secondaryForeground} />
              <Text style={[styles.contactText, { color: colors.secondaryForeground }]}>
                {data.customerPhone}
              </Text>
            </View>
          ) : null}
          {data.customerEmail ? (
            <View style={styles.contactLine}>
              <Feather name="mail" size={16} color={colors.secondaryForeground} />
              <Text style={[styles.contactText, { color: colors.secondaryForeground }]}>
                {data.customerEmail}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {profile.role === 'customer' && !data.customerContactShared && (
        <View style={[styles.sharePanel, { borderTopColor: colors.border }]}>
          <Pressable
            disabled={shareById.isPending || data.messages.length === 0}
            onPress={() => {
              if (selectedConversationId === null) return;
              setNotice('');
              shareById.mutate(
                { id: requestId, conversationId: selectedConversationId },
                {
                  onSuccess: (result) => {
                    queryClient.setQueryData(customerQueryKey, result);
                    queryClient.invalidateQueries({ queryKey: customerListQueryKey });
                    queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
                  },
                  onError: () => setNotice('Nie udało się udostępnić danych kontaktowych.'),
                },
              );
            }}
            style={[
              styles.secondaryButton,
              {
                backgroundColor: colors.secondary,
                opacity: shareById.isPending || data.messages.length === 0 ? 0.55 : 1,
              },
            ]}
          >
            {shareById.isPending ? (
              <ActivityIndicator color={colors.secondaryForeground} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>
                Udostępnij fachowcowi telefon, e-mail i adres zlecenia
              </Text>
            )}
          </Pressable>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Zrób to dopiero po rozmowie, gdy chcesz kontynuować kontakt poza aplikacją.
          </Text>
        </View>
      )}

      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        <TextInput
          value={body}
          onChangeText={setBody}
          maxLength={2000}
          multiline
          placeholder="Napisz wiadomość…"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.messageInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
          ]}
          accessibilityLabel="Treść wiadomości"
        />
        <Pressable
          disabled={sending || !body.trim()}
          onPress={submit}
          style={[
            styles.sendButton,
            { backgroundColor: colors.primary, opacity: sending || !body.trim() ? 0.55 : 1 },
          ]}
          accessibilityLabel="Wyślij wiadomość"
        >
          {sending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Feather name="send" size={18} color={colors.primaryForeground} />
          )}
        </Pressable>
      </View>
      {notice ? <Text style={[styles.error, { color: colors.destructive }]}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 19, flexShrink: 1 },
  caption: { paddingHorizontal: 18, marginTop: 7, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  threadSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, marginTop: 14 },
  threadButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  threadButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  primaryButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  secondaryButton: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'center' },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 8 },
  error: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, paddingHorizontal: 18, paddingBottom: 14, marginTop: 10 },
  messages: { marginTop: 18, padding: 14, gap: 10 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', paddingVertical: 22 },
  messageRow: { flexDirection: 'row' },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  message: { maxWidth: '85%', borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  messageBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  timestamp: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 5, opacity: 0.7 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  sharedContact: { paddingHorizontal: 18, paddingVertical: 13, gap: 8 },
  contactLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { fontFamily: 'Inter_700Bold', fontSize: 14, flexShrink: 1 },
  sharePanel: { borderTopWidth: 1, padding: 14 },
  composer: { borderTopWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  messageInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  sendButton: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reviewPanel: { borderBottomWidth: 1, padding: 14, gap: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reviewTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  ratingText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  reviewItem: { borderWidth: 1, borderRadius: 12, padding: 11, gap: 7 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stars: { flexDirection: 'row', gap: 2 },
  reviewDate: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  reviewBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  profileButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  contractorProfile: { borderWidth: 1, borderRadius: 12, padding: 13 },
  avatar: { width: 58, height: 58, borderRadius: 29, marginBottom: 9 },
});