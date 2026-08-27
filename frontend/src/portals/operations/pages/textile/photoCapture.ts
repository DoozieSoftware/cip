export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function validatePhotoFile(file: File | null): string | null {
  if (!file) return 'Photo is required';
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return 'File must be JPEG, PNG, or WebP';
  if (file.size > MAX_PHOTO_BYTES) return 'File must be ≤ 10 MB';
  return null;
}
