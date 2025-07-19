const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Plugin to add the AD_ID permission to the Android manifest
 * This is required for apps that use advertising IDs and target Android 13 (API 33) or higher
 */
const withAdIdPermission = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Check if permissions array exists
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    // Check if AD_ID permission already exists
    const adIdPermissionExists = androidManifest.manifest['uses-permission'].some(
      (permission) => 
        permission.$?.['android:name'] === 'com.google.android.gms.permission.AD_ID'
    );

    // Add AD_ID permission if it doesn't exist
    if (!adIdPermissionExists) {
      androidManifest.manifest['uses-permission'].push({
        $: {
          'android:name': 'com.google.android.gms.permission.AD_ID',
        },
      });
      console.log('Added AD_ID permission to AndroidManifest.xml');
    } else {
      console.log('AD_ID permission already exists in AndroidManifest.xml');
    }

    return config;
  });
};

module.exports = withAdIdPermission;
