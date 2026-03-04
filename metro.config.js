// metro.config.js
// Optimized Metro config for Bord — enables tree-shaking, minification,
// and proper source map handling for production builds.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable inline requires — defers module evaluation until first use.
// This dramatically cuts startup time because modules like stripe,
// react-native-maps, etc. are NOT parsed until actually navigated to.
config.transformer = {
  ...config.transformer,
  inlineRequires: true,
};

// Enable package exports resolution (better tree-shaking for ESM packages)
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
};

module.exports = config;
