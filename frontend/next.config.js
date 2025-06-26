/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    esmExternals: true,
  },
  // Remove serverComponentsExternalPackages - no longer needed in Next.js 14
  // Prisma Client works out of the box with Next.js 14
};

module.exports = nextConfig;
