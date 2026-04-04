/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' output is used in Docker (Linux). Disabled locally to avoid
  // EPERM symlink errors on Windows with pnpm.
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  transpilePackages: ['@rate-snoop/types'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
