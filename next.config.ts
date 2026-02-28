import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'drooopy.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'https://drooopy.com/api/:path*',
      },
    ];
  },
};

export default nextConfig;
