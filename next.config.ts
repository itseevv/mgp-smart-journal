import type { NextConfig } from "next";

function hostnameFromOrigin(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
  }
}

function allowedDevOrigins() {
  const origins = new Set<string>();

  for (const value of [
    process.env.APP_BASE_URL,
    process.env.ALLOWED_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
  ]) {
    const host = hostnameFromOrigin(value?.trim());
    if (host && !host.startsWith("localhost")) origins.add(host);
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins(),
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/export/daily-stamp": [
      "./public/fonts/CormorantGaramond-Medium.ttf",
      "./public/fonts/CormorantGaramond-SemiBold.ttf",
      "./public/fonts/Inter-SemiBold.ttf",
      "./public/fonts/NotoSansCJKsc-Regular.otf",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
