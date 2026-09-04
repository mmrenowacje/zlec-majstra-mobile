import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { requestCategories, useCreateRequest, useRequestUploadUrl } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { JPEG_CONTENT_TYPE, prepareJpeg, uploadPreparedImage } from '@/lib/image-upload';
import { router } from 'expo-router';

export default function NewRequestScreen() {
  const colors = useColors();
  const create = useCreateRequest();
  const requestUpload = useRequestUploadUrl();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState<(typeof requestCategories)[number]['value']>(requestCategories[0].value);
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [error, setError] = useState('');

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) setPhotos(result.assets.slice(0, 2));
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    const preparedImage = await prepareJpeg(asset.uri);
    const prepared = await requestUpload.mutateAsync({
      data: {
        name: (asset.fileName ?? 'zlecenie').replace(/\.[^.]+$/, '') + '.jpg',
        size: preparedImage.size,
        contentType: JPEG_CONTENT_TYPE,
      },
    });
    await uploadPreparedImage(prepared.uploadURL, preparedImage.uri);
    return prepared.objectPath;
  };

  const submit = async () => {
    if (title.trim().length < 3 || description.trim().length < 10 || !location.trim() || !address.trim() || !budget.trim()) {
      setError('Uzupełnij tytuł, opis, miejscowość, adres i budżet.');
      return;
    }
    setError('');
    try {
      const uploadedPhotos = await Promise.all(photos.map(uploadPhoto));
      const created = await create.mutateAsync({
        data: { title, description, location, address, budget, category, photos: uploadedPhotos },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/request/[id]', params: { id: String(created.id) } });
    } catch {
      setError('Nie udało się przesłać zdjęć lub opublikować zlecenia. Spróbuj ponownie.');
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      bottomOffset={72}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Dodaj zlecenie</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Opisz pracę konkretnie — łatwiej dostaniesz trafne zgłoszenia.</Text>
      <Text style={[styles.label, { color: colors.foreground }]}>Kategoria</Text>
      <View style={styles.categories}>
        {requestCategories.map((item) => (
          <Pressable key={item.value} onPress={() => setCategory(item.value)} style={[styles.category, { backgroundColor: category === item.value ? colors.foreground : colors.card, borderColor: colors.border }]}>
            <Text style={{ color: category === item.value ? colors.background : colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {[
        ['Tytuł zlecenia', title, setTitle, false],
        ['Miejscowość', location, setLocation, false],
        ['Adres zlecenia', address, setAddress, false],
        ['Budżet, np. 5 000–8 000 zł', budget, setBudget, false],
        ['Zakres prac', description, setDescription, true],
      ].map(([placeholder, value, setter, multiline]) => (
        <TextInput
          key={String(placeholder)}
          placeholder={String(placeholder)}
          placeholderTextColor={colors.mutedForeground}
          value={String(value)}
          onChangeText={setter as (text: string) => void}
          multiline={Boolean(multiline)}
          style={[styles.input, Boolean(multiline) && styles.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
        />
      ))}
      <Text style={[styles.addressHint, { color: colors.mutedForeground }]}>Dokładny adres zobaczy fachowiec dopiero po udostępnieniu mu danych kontaktowych.</Text>
      <Pressable onPress={pickPhoto} style={[styles.photoButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Feather name="camera" size={20} color={colors.accent} />
        <Text style={[styles.photoText, { color: colors.foreground }]}>
          {photos.length ? `Wybrano zdjęcia: ${photos.length}` : 'Dodaj zdjęcia'}
        </Text>
      </Pressable>
      {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
      <Pressable
        testID="publish-request"
        disabled={create.isPending || requestUpload.isPending}
        onPress={() => void submit()}
        style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: create.isPending || requestUpload.isPending || pressed ? 0.65 : 1 }]}
      >
        <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{create.isPending || requestUpload.isPending ? 'Przesyłam zdjęcia…' : 'Opublikuj zlecenie'}</Text>
        <Feather name="arrow-up-right" size={20} color={colors.primaryForeground} />
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingTop: 20, paddingBottom: 130, gap: 13 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, marginBottom: 8 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, fontFamily: 'Inter_500Medium', fontSize: 15 },
  addressHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: -6 },
  textarea: { minHeight: 132, paddingTop: 15, textAlignVertical: 'top' },
  photoButton: { minHeight: 58, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoText: { fontFamily: 'Inter_600SemiBold' },
  error: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  submit: { height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});