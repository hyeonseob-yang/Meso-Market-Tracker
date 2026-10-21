import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Set in .env.local (gitignored, machine-specific) to test the dev
  // server from another device, e.g. DEV_ALLOWED_ORIGIN=192.168.1.79.
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGIN ? [process.env.DEV_ALLOWED_ORIGIN] : undefined,
};

export default nextConfig;
