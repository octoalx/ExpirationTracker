/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".js", ".mjs", ".ts", ".tsx"],
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        stream: false,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
