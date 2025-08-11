const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure proper module resolution
config.resolver.alias = {
  ...config.resolver.alias,
  '@': './src',
};

// Add support for additional file extensions
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
];

// Ensure proper asset extensions
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
];

// Clear Metro cache on start
config.resetCache = true;

module.exports = config;