import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";

const isLocalhost = apiBaseUrl.includes("127.0.0.1") || apiBaseUrl.includes("localhost");
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async headers() {
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https://drooopy.com https://www.drooopy.com https://drooopy-storage.s3.us-east-1.amazonaws.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://www.googletagmanager.com",
      "connect-src 'self' https://drooopy.com https://www.drooopy.com https://maps.googleapis.com https://*.googleapis.com https://*.mercadopago.com https://*.mercadopago.com.mx wss://drooopy.com wss://www.drooopy.com",
      "frame-src 'self' https://*.mercadopago.com https://*.mercadopago.com.mx",
    ].join("; ");

    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
      },
      { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
    ];

    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
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
