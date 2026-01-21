import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://3.15.176.110:8080/:path*',
      },
    ];
  },
};

export default nextConfig;
