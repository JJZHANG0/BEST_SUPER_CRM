/** Resize an image File to a ≤maxPx square JPEG/PNG data URL for avatar storage. */
export async function resizeAvatar(file: File, maxPx = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
  if (file.size > 8 * 1024 * 1024) throw new Error('图片请小于 8 MB');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);
  const size = Math.min(maxPx, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法处理图片');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  // Prefer JPEG for smaller data URLs; fall back to PNG for transparency-heavy sources.
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(mime, 0.88);
  if (dataUrl.length > 900_000) throw new Error('压缩后仍过大，请换一张更小的图片');
  return dataUrl;
}
