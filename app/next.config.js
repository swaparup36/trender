/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      encoding: false, // tells webpack not to try bundling encoding
    };
    return config;
  },
};

module.exports = nextConfig;
