const { withProjectBuildGradle } = require('@expo/config-plugins');

const withCustomGradle = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      // Fix Kotlin version mapping issue
      config.modResults.contents = config.modResults.contents.replace(
        /kotlinVersion\s*=\s*["'][\d.]+["']/g,
        'kotlinVersion = "1.9.10"'
      );
      
      // Ensure proper Gradle plugin version
      config.modResults.contents = config.modResults.contents.replace(
        /classpath\s*\(\s*["']com\.android\.tools\.build:gradle:[\d.]+["']\s*\)/g,
        'classpath("com.android.tools.build:gradle:8.1.4")'
      );
      
      // Add Kotlin mapping fix
      if (!config.modResults.contents.includes('kotlinCompilerExtensionVersion')) {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*{/,
          `android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }`
        );
      }
    }
    return config;
  });
};

module.exports = withCustomGradle;
