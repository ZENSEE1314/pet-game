/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The user's home directory contains another package-lock.json; without this,
  // Next guesses the workspace root wrong and file tracing pulls in the world.
  outputFileTracingRoot: import.meta.dirname,
  // Produces .next/standalone — a self-contained server the Docker runtime stage
  // copies without node_modules or source.
  output: 'standalone',
  serverExternalPackages: ['bcryptjs'],
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
