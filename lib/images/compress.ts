import "server-only";
import sharp from "sharp";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 82;

/**
 * Resizes (if needed) and re-encodes as JPEG. Runs after the watermark has
 * already been composited, so the watermark survives compression as part of
 * the pixels — not as a separate overlay that could be stripped later.
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // apply EXIF orientation, then strip EXIF on output — phone photos are often rotated in metadata only
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}
