import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

export const JPEG_CONTENT_TYPE = 'image/jpeg';
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const OBJECT_PATH_PATTERN = /^\/objects\/uploads\/[a-f0-9-]+$/;

export function requestPhotoObjectPath(photo: string): string | null {
  let path = photo;
  try {
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname;
  } catch {
    return null;
  }
  if (path.startsWith('/api/storage/')) {
    path = path.slice('/api/storage'.length);
  }
  return OBJECT_PATH_PATTERN.test(path) ? path : null;
}

export async function prepareJpeg(uri: string) {
  const image = await ImageManipulator.manipulateAsync(
    uri,
    [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const info = await FileSystem.getInfoAsync(image.uri);
  if (!info.exists || typeof info.size !== 'number' || info.size < 1) {
    throw new Error('Nie udało się odczytać przygotowanego zdjęcia.');
  }
  if (info.size > MAX_IMAGE_SIZE) {
    throw new Error('Zdjęcie jest większe niż 50 MB.');
  }
  return { uri: image.uri, size: info.size };
}

export async function uploadPreparedImage(uploadURL: string, uri: string) {
  const result = await FileSystem.uploadAsync(uploadURL, uri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': JPEG_CONTENT_TYPE },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Wysyłanie zdjęcia nie powiodło się (${result.status}).`);
  }
}