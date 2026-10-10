import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@now/game-engine', '@now/game-types'],
};

export default nextConfig;
