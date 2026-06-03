import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";

const isLocalhost = apiBaseUrl.includes("127.0.0.1") || apiBaseUrl.includes("localhost");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'drooopy.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drooopy-storage.s3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      ...(isLocalhost ? [{
        protocol: 'http' as const,
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/**',
      }] : []),
    ],
  },
  async rewrites() {
    const apiBase = apiBaseUrl.endsWith("/api")
      ? apiBaseUrl.replace(/\/api$/, "")
      : apiBaseUrl;

    return [
      {
        source: '/api/backend/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
