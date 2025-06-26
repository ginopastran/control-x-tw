/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  transpilePackages: ["lucide-react"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };

    // Ensure proper alias resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": require("path").join(__dirname, "src"),
    };

    // Fix for module resolution issues in Vercel builds
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
      ".jsx": [".jsx", ".tsx"],
    };

    return config;
  },
};

module.exports = nextConfig;
