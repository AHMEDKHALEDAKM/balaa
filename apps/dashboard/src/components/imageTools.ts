/** Upright, at most 1600px, JPEG, no EXIF/GPS metadata, as a data: URL. */
async function toSmallJpeg(image: Blob) {
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.82),
  );
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(jpeg);
  });
}

/** The browser twin of the server's sharp step, for a base64 image. Returns base64. */
export async function normalizeImage(base64: string) {
  const blob = await (await fetch(`data:application/octet-stream;base64,${base64}`)).blob();
  const dataUrl = await toSmallJpeg(blob);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/**
 * A photo from the camera or gallery, of any size, made small enough to upload quickly
 * (usually 200-500 KB). Throws a readable error if the file is not a picture the phone
 * can open.
 */
export async function shrinkPhoto(file: Blob) {
  try {
    return await toSmallJpeg(file);
  } catch {
    throw new Error('تعذّر قراءة الصورة');
  }
}
