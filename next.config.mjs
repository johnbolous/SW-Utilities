import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Reading entry must keep working with a flaky site connection —
    // technicians are walking between buildings. Cache the app shell so it
    // opens instantly, and let Supabase's own client-side retry handle the
    // actual data calls (we deliberately do NOT cache API/auth responses,
    // since stale meter readings or stale sessions would be worse than a
    // visible "offline" state).
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "next-static" },
      },
      {
        urlPattern: /\/icons\/.*|\/manifest\.json/i,
        handler: "CacheFirst",
        options: { cacheName: "pwa-assets" },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp ships a native binary — must stay external to the serverless
  // bundle rather than get webpack-bundled, or image processing breaks in
  // production. (Next 14.2+ stable option; equivalent to the older
  // experimental.serverComponentsExternalPackages.)
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default withPWA(nextConfig);
