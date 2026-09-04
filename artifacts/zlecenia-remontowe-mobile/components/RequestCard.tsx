import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { resolveApiUrl, type JobRequest } from '@workspace/api-client-react';

const categoryLabels: Record<string, string> = {
  hydraulik: 'Hydraulik',
  elektryk: 'Elektryk',
  malarz: 'Malarz',
  stolarz: 'Stolarz',
  plytkarz: 'Płytkarz',
  brukarz: 'Brukarz',
  dekarz: 'Dekarz',
  wykonczenia: 'Wykończenia',
  'zlota-raczka': 'Złota Rączka',
  inne: 'inne',
  remont: 'Remont',
  budowa: 'Budowa',
  hydraulika: 'Hydraulika',
  elektryka: 'Elektryka',
};

export function RequestCard({
  request,
  onPress,
}: {
  request: JobRequest;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={`request-${request.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
            {categoryLabels[request.category] ?? request.category}
          </Text>
        </View>
        <Text style={[styles.budget, { color: colors.primary }]}>{request.budget}</Text>
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{request.title}</Text>
      <Text numberOfLines={2} style={[styles.description, { color: colors.mutedForeground }]}>
        {request.description}
      </Text>
      {request.photos?.length ? (
        <View style={styles.photos}>
          {request.photos.slice(0, 3).map((photo, index) => (
            <View key={`${photo}-${index}`} style={styles.photoWrap}>
              <Image
                source={{ uri: resolveApiUrl(photo) }}
                resizeMode="cover"
                style={styles.photo}
                accessibilityLabel={`Zdjęcie zlecenia ${index + 1}`}
              />
              {index === 2 && request.photos && request.photos.length > 3 ? (
                <View style={styles.morePhotos}>
                  <Text style={styles.morePhotosText}>+{request.photos.length - 3}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.meta}>
        <Feather name="map-pin" size={14} color={colors.mutedForeground} />
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {request.location}
        </Text>
        <Feather name="arrow-up-right" size={16} color={colors.foreground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  budget: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 23 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  photos: { flexDirection: 'row', gap: 7, height: 92 },
  photoWrap: { flex: 1, overflow: 'hidden', borderRadius: 10 },
  photo: { width: '100%', height: '100%' },
  morePhotos: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14, 30, 38, 0.62)' },
  morePhotosText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
});