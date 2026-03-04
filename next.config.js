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
  basePath: '/backcrypto',
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
  },
  assetPrefix: '/backcrypto',
  outputFileTracingRoot: projectRoot,
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  webpack: (config) => {
    config.resolve.symlinks = false;
    config.context = projectRoot;
    return config;
  },
}

module.exports = nextConfig
