import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify deployment — output is handled by Next.js adapter
  // No static export needed; Netlify detects Next.js automatically

  images: {
    // Allow images from backend if needed
    remotePatterns: [
      {
        protocol: "https",
        hostname: "solenos-backend.up.railway.app",
      },
    ],
  },

  webpack: (config, { isServer }) => {
    // Living Care Record persistence uses Node fs on the server only.
    // Client imports of shared spine modules must not crash on node:fs / fs.
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
