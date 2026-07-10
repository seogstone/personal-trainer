import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitness/analytics", "@fitness/shared", "@fitness/ui"]
};

export default nextConfig;
