import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@now/game-engine', '@now/game-types'],
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
