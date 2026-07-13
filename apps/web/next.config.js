/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  trailingSlash: true,
  experimental: {
    forceSwcTransforms: true,
  },
  // Completely disable static generation
  generateEtags: false,
  poweredByHeader: false,
  compress: true,
  // Disable static page generation
  images: {
    domains: [],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ra-trivia.onrender.com/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
