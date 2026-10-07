const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 0.75;

export async function optimizeImageFile(file, maxEdge = MAX_IMAGE_EDGE) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    if (scale === 1 && file.size <= 180 * 1024) {
      image.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      image.close();
      return file;
    }
    context.drawImage(image, 0, 0, width, height);
    image.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
    if (!blob || (blob.size >= file.size && scale === 1)) {
      return file;
    }

    const filename = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${filename}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file;
  }
}
