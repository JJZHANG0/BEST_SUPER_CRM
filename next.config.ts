import type { NextConfig } from 'next';
const isStatic = process.env.NEXUS_STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const config: NextConfig = {
  ...(isStatic ? { output: 'export', distDir: '.next-static', trailingSlash: true, basePath, images: { unoptimized: true } } : {}),
};
export default config;
