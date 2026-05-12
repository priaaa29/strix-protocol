/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: () => 'build-' + Date.now(),
  webpack: (config) => {
    // Required for stellar-sdk / buffer support in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
      stream: false,
      crypto: false,
      fs: false,
      path: false,
    };
    return config;
  },
};

module.exports = nextConfig;
