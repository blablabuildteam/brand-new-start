import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dynamic desk pages stay in the client cache, so tab switches don't wait on the server.
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
};

export default nextConfig;
