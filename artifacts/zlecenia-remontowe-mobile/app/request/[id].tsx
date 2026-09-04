import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  getGetRequestQueryKey, 
  getListRequestConversationsQueryKey,
  useGetRequest, 
  useGetSubscription,
  useUpdateRequest,
  useGetMyProfile,
  useListRequestReviews,
  useListRequestConversations,
  useListReviewCandidates,
  useCreateRequestReview,
  useCreateReviewReply,
  useAddProjectPhoto,
  useRequestUploadUrl,
  getListRequestReviewsQueryKey,
  getListReviewCandidatesQueryKey,
  ReviewCandidate,
  Review,
  resolveApiUrl
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RequestConversation } from '@/components/request-conversation';
import { JPEG_CONTENT_TYPE, prepareJpeg, requestPhotoObjectPath, uploadPreparedImage } from '@/lib/image-upload';

function ReviewForm({ requestId, candidate }: { requestId: number, candidate: ReviewCandidate }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const createReview = useCreateRequestReview();

  const handleSubmit = () => {
    if (rating < 1 || rating > 5) return;
    if (body.trim().length === 0) return;

    createReview.mutate(
      { id: requestId, data: { contractorId: candidate.id, rating, body: body.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRequestReviewsQueryKey(requestId) });
          queryClient.invalidateQueries({ queryKey: getListReviewCandidatesQueryKey(requestId) });
        }
      }
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.section, { color: colors.foreground, fontSize: 17 }]}>Oceń fachowca: {candidate.displayName}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <Pressable key={star} onPress={() => setRating(star)} hitSlop={10}>
            <Ionicons name={star <= rating ? "star" : "star-outline"} size={36} color={colors.primary} />
          </Pressable>
        ))}
      </View>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        placeholder="Napisz krótką opinię (wymagane)..."
        placeholderTextColor={colors.mutedForeground}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={3}
      />
      <Pressable 
        onPress={handleSubmit} 
        disabled={createReview.isPending || rating === 0 || body.trim().length === 0}
        style={[styles.button, { backgroundColor: colors.primary, marginTop: 12, opacity: (rating === 0 || body.trim().length === 0 || createReview.isPending) ? 0.55 : 1 }]}
      >
        {createReview.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Wystaw opinię</Text>
        )}
      </Pressable>
    </View>
  );
}

function ReviewItem({ review, isContractor, profileId, requestId }: { review: Review, isContractor: boolean, profileId?: string, requestId: number }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const createReply = useCreateReviewReply();
  const requestUpload = useRequestUploadUrl();
  const addPhoto = useAddProjectPhoto();

  const canReply = isContractor && review.contractorId === profileId && !review.reply;
  const canAddPhotos = isContractor && review.contractorId === profileId && review.photos.length < 8;

  const choosePhoto = async () => {
    try {
      setPhotoError('');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const preparedImage = await prepareJpeg(asset.uri);
      const prepared = await requestUpload.mutateAsync({
        data: {
          name: (asset.fileName ?? 'realizacja').replace(/\.[^.]+$/, '') + '.jpg',
          size: preparedImage.size,
          contentType: JPEG_CONTENT_TYPE,
        },
      });
      await uploadPreparedImage(prepared.uploadURL, preparedImage.uri);
      await addPhoto.mutateAsync({
        id: requestId,
        reviewId: review.id,
        data: { objectPath: prepared.objectPath },
      });
      await queryClient.invalidateQueries({ queryKey: getListRequestReviewsQueryKey(requestId) });
    } catch {
      const message = 'Nie udało się dodać zdjęcia. Wybierz JPG, PNG lub WebP i spróbuj ponownie.';
      setPhotoError(message);
      Alert.alert('Nie udało się dodać zdjęcia', message);
    }
  };

  const handleReply = () => {
    if (replyBody.trim().length === 0) return;
    createReply.mutate(
      { id: requestId, reviewId: review.id, data: { body: replyBody.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRequestReviewsQueryKey(requestId) });
          setIsReplying(false);
        }
      }
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={[styles.section, { color: colors.foreground, fontSize: 16 }]}>{review.contractorName}</Text>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {[1, 2, 3, 4, 5].map(star => (
            <Ionicons key={star} name={star <= review.rating ? "star" : "star-outline"} size={16} color={colors.primary} />
          ))}
        </View>
      </View>
      <Text style={[styles.body, { color: colors.foreground }]}>{review.body}</Text>
      {review.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
          {review.photos.map((photo) => <Image key={photo.id} source={{ uri: resolveApiUrl(photo.imageUrl) }} style={styles.projectPhoto} />)}
        </ScrollView>
      )}
      {canAddPhotos && (
        <Pressable onPress={() => void choosePhoto()} disabled={requestUpload.isPending || addPhoto.isPending} style={[styles.photoButton, { borderColor: colors.border, opacity: requestUpload.isPending || addPhoto.isPending ? 0.55 : 1 }]}>
          <Feather name="camera" size={17} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            {requestUpload.isPending || addPhoto.isPending ? 'Przesyłanie…' : 'Dodaj zdjęcie realizacji'}
          </Text>
        </Pressable>
      )}
      {photoError ? <Text style={[styles.error, { color: colors.destructive }]}>{photoError}</Text> : null}
      
      {review.reply && (
        <View style={{ marginTop: 16, paddingLeft: 14, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.primary, marginBottom: 6 }}>Odpowiedź fachowca</Text>
          <Text style={[styles.body, { color: colors.mutedForeground, fontSize: 14 }]}>{review.reply.body}</Text>
        </View>
      )}

      {canReply && !isReplying && (
        <Pressable onPress={() => setIsReplying(true)} style={{ marginTop: 16, alignSelf: 'flex-start' }} hitSlop={10}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.primary }}>Odpowiedz na opinię</Text>
        </Pressable>
      )}

      {canReply && isReplying && (
        <View style={{ marginTop: 16, gap: 10 }}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Twoja odpowiedź (będzie widoczna publicznie)..."
            placeholderTextColor={colors.mutedForeground}
            value={replyBody}
            onChangeText={setReplyBody}
            multiline
            numberOfLines={3}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable 
              onPress={() => setIsReplying(false)} 
              style={[styles.button, { flex: 1, backgroundColor: colors.secondary }]}
            >
              <Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>Anuluj</Text>
            </Pressable>
            <Pressable 
              onPress={handleReply}
              disabled={createReply.isPending || replyBody.trim().length === 0}
              style={[styles.button, { flex: 1, backgroundColor: colors.primary, opacity: (replyBody.trim().length === 0 || createReply.isPending) ? 0.55 : 1 }]}
            >
              {createReply.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Wyślij</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function ReviewsSection({ requestId, requestStatus, isCustomer, isContractor, profileId }: { requestId: number, requestStatus: string, isCustomer: boolean, isContractor: boolean, profileId?: string }) {
  const colors = useColors();

  const reviews = useListRequestReviews(requestId, {
    query: {
      queryKey: getListRequestReviewsQueryKey(requestId),
      enabled: Number.isFinite(requestId) && requestStatus === 'completed',
    }
  });

  const candidates = useListReviewCandidates(requestId, {
    query: {
      queryKey: getListReviewCandidatesQueryKey(requestId),
      enabled: Number.isFinite(requestId) && requestStatus === 'completed' && isCustomer,
    }
  });

  if (requestStatus !== 'completed') return null;

  const hasReviews = (reviews.data?.length ?? 0) > 0;
  const hasCandidates = candidates.data?.some(c => !c.reviewed) ?? false;

  return (
    <View style={{ gap: 15, marginTop: 10 }}>
      <Text style={[styles.title, { color: colors.foreground, fontSize: 24 }]}>Opinie i Oceny</Text>
      
      {isCustomer && candidates.data?.map(candidate => {
        if (candidate.reviewed) return null;
        return <ReviewForm key={candidate.id} requestId={requestId} candidate={candidate} />;
      })}

      {!hasReviews && !hasCandidates && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', paddingVertical: 30 }]}>
          <Feather name="message-square" size={32} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 15 }}>Brak opinii dla tego zlecenia.</Text>
        </View>
      )}

      {reviews.data?.map(review => (
        <ReviewItem 
          key={review.id} 
          review={review} 
          isContractor={isContractor} 
          profileId={profileId} 
          requestId={requestId} 
        />
      ))}
    </View>
  );
}

export default function RequestDetailScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { id, conversationId: conversationIdParam } = useLocalSearchParams<{ id: string; conversationId?: string }>();
  const requestId = Number(id);
  const initialConversationId = conversationIdParam ? Number(conversationIdParam) : null;
  const request = useGetRequest(requestId, {
    query: {
      enabled: Number.isFinite(requestId),
      queryKey: getGetRequestQueryKey(requestId),
    },
  });
  const subscription = useGetSubscription();
  const updateRequest = useUpdateRequest();
  const requestPhotoUpload = useRequestUploadUrl();
  const profile = useGetMyProfile();
  const [requestPhotoError, setRequestPhotoError] = useState('');
  const [editForm, setEditForm] = useState<{ title: string; description: string; location: string; address: string; budget: string } | null>(null);
  const conversations = useListRequestConversations(requestId, {
    query: {
      queryKey: getListRequestConversationsQueryKey(requestId),
      enabled: Number.isFinite(requestId) && profile.data?.role === 'customer',
      retry: false,
    },
  });

  if (request.isLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!request.data) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Nie znaleziono zlecenia.</Text></View>;

  const data = request.data;

  const isCustomer = profile.data?.role === 'customer';
  const isContractor = profile.data?.role === 'contractor';
  const editingLocked = conversations.data?.some(item => item.customerContactShared) ?? false;
  const storedPhotoPaths = (data.photos ?? [])
    .map(requestPhotoObjectPath)
    .filter((photo): photo is string => Boolean(photo));
  const saveRequest = async () => {
    if (!editForm) return;
    try {
      await updateRequest.mutateAsync({ id: requestId, data: editForm });
      setEditForm(null);
      await queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
    } catch {
      Alert.alert('Nie udało się zapisać', 'Dane mogły zostać już udostępnione fachowcowi.');
    }
  };
  const addRequestPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
        selectionLimit: Math.max(1, 2 - storedPhotoPaths.length),
      quality: 0.85,
    });
    if (result.canceled) return;
    try {
      setRequestPhotoError('');
      const objectPaths = await Promise.all(result.assets.slice(0, 2 - storedPhotoPaths.length).map(async (asset) => {
        const image = await prepareJpeg(asset.uri);
        const prepared = await requestPhotoUpload.mutateAsync({ data: { name: 'zlecenie.jpg', size: image.size, contentType: JPEG_CONTENT_TYPE } });
        await uploadPreparedImage(prepared.uploadURL, image.uri);
        return prepared.objectPath;
      }));
      await updateRequest.mutateAsync({ id: requestId, data: { photos: [...storedPhotoPaths, ...objectPaths] } });
      await queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
    } catch {
      setRequestPhotoError('Nie udało się dodać zdjęć. Spróbuj ponownie.');
    }
  };
  const advanceRequest = () => {
    const nextStatus = data.status === 'open' ? 'in_progress' : 'completed';
    updateRequest.mutate(
      { id: requestId, data: { status: nextStatus } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) }) },
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={[styles.category, { backgroundColor: colors.secondary }]}><Text style={{ color: colors.secondaryForeground, fontFamily: 'Inter_700Bold', textTransform: 'capitalize' }}>{data.category}</Text></View>
        <Text style={[styles.title, { color: colors.foreground }]}>{data.title}</Text>
        <View style={styles.meta}><Feather name="map-pin" size={17} color={colors.accent} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{data.location}</Text></View>
        <Text style={[styles.budget, { color: colors.primary }]}>{data.budget}</Text>
        {data.address ? (
          <View style={[styles.addressCard, { backgroundColor: colors.secondary, borderColor: colors.border }]} testID="request-address">
            <Feather name="map-pin" size={18} color={colors.secondaryForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.addressLabel, { color: colors.secondaryForeground }]}>Adres zlecenia</Text>
              <Text style={[styles.addressText, { color: colors.foreground }]}>{data.address}</Text>
            </View>
          </View>
        ) : isContractor ? (
          <View style={styles.addressNotice}>
            <Feather name="lock" size={15} color={colors.mutedForeground} />
            <Text style={[styles.addressNoticeText, { color: colors.mutedForeground }]}>Dokładny adres będzie widoczny po udostępnieniu danych kontaktowych.</Text>
          </View>
        ) : null}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.section, { color: colors.foreground }]}>Zakres prac</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{data.description}</Text>
        </View>
        {data.photos?.length ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.section, { color: colors.foreground }]}>Zdjęcia prac do wykonania</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.requestPhotos}>
              {data.photos.map((photo, index) => (
                <Image
                  key={`${photo}-${index}`}
                  source={{ uri: resolveApiUrl(photo) }}
                  style={styles.requestPhoto}
                  resizeMode="cover"
                  accessibilityLabel={`Zdjęcie prac do wykonania ${index + 1}`}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
        {isCustomer && !editingLocked && storedPhotoPaths.length < 2 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.section, { color: colors.foreground }]}>Zdjęcia zlecenia</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>Dodaj zdjęcia także do już opublikowanego zlecenia.</Text>
            <Pressable onPress={() => void addRequestPhotos()} disabled={requestPhotoUpload.isPending || updateRequest.isPending} style={[styles.photoButton, { borderColor: colors.border }]}>
              <Feather name="camera" size={17} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{requestPhotoUpload.isPending || updateRequest.isPending ? 'Przesyłanie…' : 'Dodaj zdjęcia'}</Text>
            </Pressable>
            {!!requestPhotoError && <Text style={[styles.error, { color: colors.destructive }]}>{requestPhotoError}</Text>}
          </View>
        ) : null}
        {isCustomer && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {editingLocked ? (
              <>
                <Text style={[styles.section, { color: colors.foreground }]}>Edycja zlecenia zakończona</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>Dane zostały już udostępnione fachowcowi.</Text>
              </>
            ) : editForm ? (
              <>
                <Text style={[styles.section, { color: colors.foreground }]}>Edytuj zlecenie</Text>
                {(['title', 'location', 'address', 'budget'] as const).map(field => <TextInput key={field} value={editForm[field]} onChangeText={value => setEditForm(current => current ? { ...current, [field]: value } : current)} placeholder={{ title: 'Tytuł', location: 'Miejscowość', address: 'Adres', budget: 'Budżet' }[field]} placeholderTextColor={colors.mutedForeground} style={[styles.editInput, { borderColor: colors.border, color: colors.foreground }]} />)}
                <TextInput value={editForm.description} onChangeText={value => setEditForm(current => current ? { ...current, description: value } : current)} multiline placeholder="Opis" placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
                <Pressable onPress={() => void saveRequest()} disabled={updateRequest.isPending} style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}><Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>Zapisz zmiany</Text></Pressable>
                <Pressable onPress={() => setEditForm(null)}><Text style={[styles.buttonText, { color: colors.mutedForeground }]}>Anuluj</Text></Pressable>
              </>
            ) : (
              <Pressable onPress={() => setEditForm({ title: data.title, description: data.description, location: data.location, address: data.address ?? '', budget: data.budget })} style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}><Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>Edytuj zlecenie</Text></Pressable>
            )}
          </View>
        )}
        {profile.data && (
          <RequestConversation
            requestId={requestId}
            profile={profile.data}
            canStartConversation={Boolean(isContractor && subscription.data?.canUnlockContacts)}
            initialConversationId={Number.isFinite(initialConversationId) ? initialConversationId : null}
          />
        )}

        {data.status === 'completed' && (
          <View style={[styles.contact, { backgroundColor: colors.secondary, flexDirection: 'row', alignItems: 'center' }]}>
            <Feather name="check-circle" size={24} color={colors.foreground} />
            <Text style={[styles.section, { color: colors.foreground, flex: 1 }]}>To zlecenie zostało zakończone</Text>
          </View>
        )}

        {isCustomer && data.status !== 'completed' && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.section, { color: colors.foreground }]}>Aktualizuj status pracy</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>Poinformuj fachowców, na jakim etapie jest zlecenie.</Text>
            <Pressable
              testID="button-advance-request-status"
              onPress={advanceRequest}
              disabled={updateRequest.isPending}
              style={[styles.secondaryButton, { backgroundColor: colors.secondary, opacity: updateRequest.isPending ? 0.55 : 1 }]}
            >
              {updateRequest.isPending ? (
                <ActivityIndicator color={colors.secondaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>
                  {data.status === 'open' ? 'Oznacz jako rozpoczęte' : 'Oznacz jako zakończone'}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <ReviewsSection
          requestId={requestId}
          requestStatus={data.status}
          isCustomer={isCustomer}
          isContractor={isContractor}
          profileId={profile.data?.id}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 15 },
  category: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  budget: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  addressCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7 },
  addressText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginTop: 3 },
  addressNotice: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  addressNoticeText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 10 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  contact: { borderRadius: 20, padding: 20, gap: 10 },
  contactText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  secondaryButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  projectPhoto: { width: 180, height: 130, borderRadius: 12 },
  requestPhotos: { gap: 10 },
  requestPhoto: { width: 270, height: 190, borderRadius: 12 },
  photoButton: { minHeight: 46, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    minHeight: 85,
    textAlignVertical: 'top',
  },
  editInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontFamily: 'Inter_400Regular', fontSize: 15 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
});