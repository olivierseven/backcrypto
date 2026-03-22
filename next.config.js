/** @type {import('next').NextConfig} */
const path = require('path');

const projectRoot = path.resolve(__dirname);

// Versão = branch atual (automático: Vercel, CI ou git)
function getAppVersion() {
  if (process.env.VERCEL_GIT_COMMIT_REF) return process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;
  try {
    const { execSync } = require('child_process');
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim() || '';
  } catch {
    return '';
  }
}

const nextConfig = {
  basePath: '/crypto',
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
  },
  // Não duplicar com basePath: o Next já serve `_next/static` em `/crypto/_next/...`.
  // assetPrefix igual ao basePath em dev costuma agravar ChunkLoadError/timeout ao pedir chunks.
  outputFileTracingRoot: projectRoot,
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.symlinks = false;
    config.context = projectRoot;
    if (dev && !isServer && config.output) {
      config.output.chunkLoadTimeout = 120000;
    }
    return config;
  },
}

module.exports = nextConfig
