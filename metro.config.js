const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { getDefaultConfig } = require('expo/metro-config');

// Get the default Expo Metro config
const defaultConfig = getDefaultConfig(__dirname);

// Get Sentry config
const sentryConfig = getSentryExpoConfig(__dirname);

// Merge configurations
const config = {
  ...defaultConfig,
  ...sentryConfig,
  resolver: {
    ...defaultConfig.resolver,
    ...sentryConfig.resolver,
    // Add platform-specific extensions for better Android resolution
    platforms: ['ios', 'android', 'native', 'web'],
    // Ensure proper asset extensions
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'bin', 'txt', 'jpg', 'png', 'json', 'gif', 'webp', 'svg'
    ],
    // Add source extensions for better module resolution
    sourceExts: [
      ...defaultConfig.resolver.sourceExts,
      'jsx', 'js', 'ts', 'tsx', 'json'
    ]
  },
  transformer: {
    ...defaultConfig.transformer,
    ...sentryConfig.transformer,
    // Enable inline requires for better performance
    inlineRequires: true,
    // Add minifier options
    minifierConfig: {
      mangle: {
        keep_fnames: true,
      },
      output: {
        ascii_only: true,
        quote_style: 3,
        wrap_iife: true,
      },
      sourceMap: {
        includeSources: false,
      },
      toplevel: false,
      compress: {
        reduce_funcs: false,
      },
    },
  },
};

module.exports = config;
