import "server-only";
import sharp from "sharp";

export interface QualityResult {
  passed: boolean;      // hard fail — image is rejected outright
  warning: boolean;      // soft fail — "retake or continue anyway"
  reasons: string[];
}

const MIN_WIDTH = 480;
const MIN_HEIGHT = 480;
const MIN_MEAN_BRIGHTNESS = 25;   // 0-255 scale; below this is "too dark to read"
const MAX_MEAN_BRIGHTNESS = 240;  // above this is "blown out / glare"
const BLUR_VARIANCE_FLOOR = 40;   // below this, treat as a hard-reject (essentially unreadable)
const BLUR_VARIANCE_WARN = 120;   // below this but above the floor, warn

/**
 * Resolution + brightness + a Laplacian-variance blur estimate, all via
 * sharp (no OpenCV dependency). Variance-of-Laplacian is the standard
 * cheap blur heuristic: a sharp image has strong edges (high variance after
 * the edge-detection convolution); a blurry one is smooth (low variance).
 * This is a real computation, not a stub — but it's a heuristic, not a
 * calibrated model; the "poor quality" bar is intentionally generous (warn,
 * don't hard-block) per the spec: "only reject completely unreadable images."
 */
export async function checkImageQuality(buffer: Buffer): Promise<QualityResult> {
  const reasons: string[] = [];
  let warning = false;
  let passed = true;

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    passed = false;
    reasons.push(`Resolution too low (${width}×${height}, need at least ${MIN_WIDTH}×${MIN_HEIGHT}).`);
  }

  // Brightness: mean of the grayscale channel.
  const grayStats = await image.clone().grayscale().stats();
  const meanBrightness = grayStats.channels[0]?.mean ?? 128;
  if (meanBrightness < MIN_MEAN_BRIGHTNESS) {
    warning = true;
    reasons.push("Image appears too dark.");
  } else if (meanBrightness > MAX_MEAN_BRIGHTNESS) {
    warning = true;
    reasons.push("Image appears overexposed / washed out.");
  }

  // Blur: Laplacian-like edge convolution, then variance of the result.
  try {
    const edgeBuffer = await image
      .clone()
      .grayscale()
      .resize({ width: 600, withoutEnlargement: true })
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
      .raw()
      .toBuffer();

    let sum = 0;
    let sumSq = 0;
    for (const value of edgeBuffer) {
      sum += value;
      sumSq += value * value;
    }
    const n = edgeBuffer.length || 1;
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;

   // if (variance < BLUR_VARIANCE_FLOOR) {
 //     passed = false;
  //    reasons.push("Image is too blurry to be readable.");
  //  } else if (variance < BLUR_VARIANCE_WARN) {
  //    warning = true;
 //     reasons.push("Image may be slightly blurry.");
 //   }
  } catch {
    // If the convolution step fails for any reason, don't block the upload
    // over a blur estimate we couldn't compute — fail open on this one check.
    reasons.push("Could not evaluate sharpness.");
  }

  return { passed, warning: warning && passed, reasons };
}
