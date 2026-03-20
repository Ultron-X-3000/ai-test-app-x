import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove "export" - API routes need a server
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
