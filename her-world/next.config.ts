import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@pump-fun/pump-sdk'],
  async headers() {
    return [{ source: '/operator/:path*', headers: [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
    ] }];
  },
};

export default nextConfig;
