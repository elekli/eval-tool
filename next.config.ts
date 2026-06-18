import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // eval-tool: local-only, no remote image hosts needed
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
