import "server-only";
import sharp from "sharp";

export interface WatermarkInfo {
  buildingName: string;
  meterCode: string;
  readingType: string; // "LOW" | "MEDIUM" | "SOLAR" | "WATER" | "KIOSK"
  capturedAt: Date;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Bug fix: this used to read capturedAt.getDate()/.getHours()/etc, which
// use the server process's own timezone (Vercel's Node runtime defaults to
// UTC). A photo taken at, say, 1am Cairo time is 11pm UTC the previous day —
// the watermark would have shown the wrong date and a 2-3 hour-off time.
// Format explicitly in the facility's timezone instead.
const FACILITY_TIMEZONE = "Africa/Cairo";

function facilityDateTimeParts(date: Date) {
  const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: FACILITY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const [yyyy, mm, dd] = dateFmt.format(date).split("-");
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FACILITY_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true,
  });
  // en-US with hour12 formats like "9:15 AM" — split the AM/PM off.
  const [time, ampm] = timeFmt.format(date).split(" ");
  return { dd, mm, yyyy, time, ampm };
}

/**
 * Burns a small, semi-transparent watermark into the bottom-left corner —
 * never covering the meter display, which is always the visual focus of
 * these photos and near-centered by the technician. The watermark is
 * rendered as an SVG overlay (sharp has no native text API) and composited
 * onto the source image, so it becomes part of the stored file itself.
 */
export async function applyWatermark(buffer: Buffer, info: WatermarkInfo): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 900;

  const barHeight = Math.max(64, Math.round(height * 0.12));
  const fontSize = Math.max(12, Math.round(barHeight * 0.16));
  const lineHeight = fontSize * 1.35;
  const padding = Math.round(fontSize * 0.6);

  const { dd, mm, yyyy, time, ampm } = facilityDateTimeParts(info.capturedAt);

  const lines = [
    escapeXml(info.buildingName),
    escapeXml(info.meterCode),
    escapeXml(`${dd}-${mm}-${yyyy}`),
    escapeXml(`${time} ${ampm}`),
  ];

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${height - barHeight}" width="${Math.min(width, 340)}" height="${barHeight}"
            fill="black" fill-opacity="0.45" rx="6" />
      <text x="${padding}" y="${height - barHeight + padding + fontSize}"
            font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="white">
        ${lines
          .map(
            (line, i) =>
              `<tspan x="${padding}" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`
          )
          .join("")}
      </text>
    </svg>
  `;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toBuffer();
}
