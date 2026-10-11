const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 0.75;

export async function optimizeImageFile(file, maxEdge = MAX_IMAGE_EDGE) {
  const isHeic = /^image\/hei[cf](?:-sequence)?$/i.test(file?.type || '') || /\.(?:heic|heif)$/i.test(file?.name || '');
  let source = file;

  if (isHeic) {
    try {
      const { convertHeic } = await import('@keeratita/heic-converter');
      const jpeg = await convertHeic(file, {
        to: 'jpeg',
        quality: 0.88,
        maxWidth: maxEdge,
        maxHeight: maxEdge,
      });
      const filename = file.name.replace(/\.(?:heic|heif)$/i, '') || 'image';
      source = new File([jpeg], `${filename}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
    } catch (error) {
      console.error('Profile photo HEIC conversion failed:', error);
      throw new Error('This phone photo could not be converted. Please choose a JPG, PNG, or WebP photo.');
    }
  }

  if (!source?.type?.startsWith('image/') || source.type === 'image/gif' || source.type === 'image/svg+xml') {
    return source;
  }

  try {
    const image = await createImageBitmap(source);
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    if (scale === 1 && source.size <= 180 * 1024) {
      image.close();
      return source;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      image.close();
      return source;
    }
    context.drawImage(image, 0, 0, width, height);
    image.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
    if (!blob || (blob.size >= source.size && scale === 1)) {
      return source;
    }

    const filename = source.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${filename}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return source;
  }
}
