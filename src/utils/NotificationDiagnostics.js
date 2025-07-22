import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Import notifications with error handling
let Notifications;
let isNotificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  isNotificationsAvailable = true;
  console.log('✅ [DIAG] expo-notifications imported successfully');
} catch (error) {
  console.log('❌ [DIAG] Failed to import expo-notifications:', error.message);
  isNotificationsAvailable = false;
}

/**
 * Comprehensive notification diagnostics
 * This tool helps identify why notifications aren't working
 */
export class NotificationDiagnostics {
  
  static async runFullDiagnostics() {
    console.log('🔍 [DIAG] ===== NOTIFICATION DIAGNOSTICS START =====');
    
    const results = {
      environment: await this.checkEnvironment(),
      device: await this.checkDevice(),
      permissions: await this.checkPermissions(),
      expo: await this.checkExpoConfig(),
      firebase: await this.checkFirebaseConfig(),
      token: await this.checkTokenGeneration(),
      summary: {}
    };
    
    results.summary = this.generateSummary(results);
    
    console.log('🔍 [DIAG] ===== DIAGNOSTIC RESULTS =====');
    console.log(JSON.stringify(results, null, 2));
    console.log('🔍 [DIAG] ===== DIAGNOSTICS END =====');
    
    return results;
  }
  
  static async checkEnvironment() {
    console.log('🔍 [DIAG] Checking environment...');
    
    const env = {
      platform: Platform.OS,
      isDevice: Device.isDevice,
      deviceType: Device.deviceType,
      deviceName: Device.deviceName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      modelName: Device.modelName,
      brand: Device.brand,
      manufacturer: Device.manufacturer,
      isExpoGo: Constants.appOwnership === 'expo',
      executionEnvironment: Constants.executionEnvironment,
      appOwnership: Constants.appOwnership,
      notificationsAvailable: isNotificationsAvailable
    };
    
    console.log('📱 [DIAG] Environment:', env);
    return env;
  }
  
  static async checkDevice() {
    console.log('🔍 [DIAG] Checking device capabilities...');
    
    const device = {
      isPhysicalDevice: Device.isDevice,
      supportsNotifications: Platform.OS === 'ios' || Platform.OS === 'android',
      hasGooglePlayServices: Platform.OS === 'android' ? 'unknown' : 'n/a'
    };
    
    // Check for Google Play Services on Android
    if (Platform.OS === 'android') {
      try {
        // This is a basic check - in a real scenario you might want to use a library
        device.hasGooglePlayServices = 'assumed_yes';
      } catch (error) {
        device.hasGooglePlayServices = 'unknown';
      }
    }
    
    console.log('📱 [DIAG] Device capabilities:', device);
    return device;
  }
  
  static async checkPermissions() {
    console.log('🔍 [DIAG] Checking notification permissions...');
    
    if (!isNotificationsAvailable) {
      return {
        available: false,
        error: 'expo-notifications not available'
      };
    }
    
    try {
      const permissions = await Notifications.getPermissionsAsync();
      console.log('🔐 [DIAG] Current permissions:', permissions);
      
      const result = {
        available: true,
        current: permissions,
        canAskAgain: permissions.canAskAgain,
        granted: permissions.status === 'granted'
      };
      
      // Try requesting permissions if not granted
      if (permissions.status !== 'granted') {
        console.log('🔐 [DIAG] Attempting to request permissions...');
        const requestResult = await Notifications.requestPermissionsAsync();
        console.log('🔐 [DIAG] Permission request result:', requestResult);
        result.requestResult = requestResult;
      }
      
      return result;
    } catch (error) {
      console.log('❌ [DIAG] Error checking permissions:', error);
      return {
        available: true,
        error: error.message
      };
    }
  }
  
  static async checkExpoConfig() {
    console.log('🔍 [DIAG] Checking Expo configuration...');
    
    const config = {
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
      name: Constants.expoConfig?.name,
      slug: Constants.expoConfig?.slug,
      version: Constants.expoConfig?.version,
      plugins: Constants.expoConfig?.plugins,
      hasNotificationPlugin: false
    };
    
    // Check if expo-notifications plugin is configured
    if (config.plugins && Array.isArray(config.plugins)) {
      config.hasNotificationPlugin = config.plugins.some(plugin => 
        plugin === 'expo-notifications' || 
        (Array.isArray(plugin) && plugin[0] === 'expo-notifications')
      );
    }
    
    console.log('⚙️ [DIAG] Expo config:', config);
    return config;
  }
  
  static async checkFirebaseConfig() {
    console.log('🔍 [DIAG] Checking Firebase configuration...');
    
    // This is a basic check - we can't directly access the google-services.json
    // but we can check if Firebase-related functionality works
    const firebase = {
      configFilePresent: 'unknown', // We added it manually
      projectId: 'jyotish2-dd398', // From the config file
      canInitialize: false
    };
    
    try {
      // Try to initialize Firebase functionality through Expo
      if (isNotificationsAvailable) {
        // If we can get permissions, Firebase config is likely working
        const permissions = await Notifications.getPermissionsAsync();
        firebase.canInitialize = true;
      }
    } catch (error) {
      firebase.error = error.message;
    }
    
    console.log('🔥 [DIAG] Firebase config:', firebase);
    return firebase;
  }
  
  static async checkTokenGeneration() {
    console.log('🔍 [DIAG] Checking FCM token generation...');
    
    if (!isNotificationsAvailable) {
      return {
        available: false,
        error: 'expo-notifications not available'
      };
    }
    
    try {
      // First ensure we have permissions
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== 'granted') {
        const requestResult = await Notifications.requestPermissionsAsync();
        if (requestResult.status !== 'granted') {
          return {
            available: true,
            error: 'Permissions not granted',
            permissions: requestResult
          };
        }
      }
      
      // Try to get the token
      console.log('🎫 [DIAG] Attempting to generate FCM token...');
      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      
      const token = tokenResult.data;
      console.log('🎫 [DIAG] Token generation result:', token);
      
      const result = {
        available: true,
        token: token,
        isValid: token && token.startsWith('ExponentPushToken['),
        isMock: token && (token.includes('mock') || token.includes('MOCK')),
        length: token?.length
      };
      
      return result;
    } catch (error) {
      console.log('❌ [DIAG] Token generation error:', error);
      return {
        available: true,
        error: error.message,
        stack: error.stack
      };
    }
  }
  
  static generateSummary(results) {
    const issues = [];
    const recommendations = [];
    
    // Check environment issues
    if (!results.environment.isDevice) {
      issues.push('Running on simulator/emulator - notifications may not work properly');
      recommendations.push('Test on a physical device');
    }
    
    if (results.environment.isExpoGo) {
      issues.push('Running in Expo Go - FCM tokens may be limited');
      recommendations.push('Use development build for full FCM functionality');
    }
    
    if (!results.environment.notificationsAvailable) {
      issues.push('expo-notifications module not available');
      recommendations.push('Check if expo-notifications is properly installed');
    }
    
    // Check permission issues
    if (results.permissions.error) {
      issues.push(`Permission error: ${results.permissions.error}`);
      recommendations.push('Check device notification settings');
    } else if (results.permissions.available && !results.permissions.granted) {
      issues.push('Notification permissions not granted');
      recommendations.push('Grant notification permissions in device settings');
    }
    
    // Check configuration issues
    if (!results.expo.hasNotificationPlugin) {
      issues.push('expo-notifications plugin not found in config');
      recommendations.push('Add expo-notifications to plugins in app.config.js');
    }
    
    if (!results.expo.projectId) {
      issues.push('EAS project ID not configured');
      recommendations.push('Add EAS project ID to app.config.js');
    }
    
    // Check token generation issues
    if (results.token.error) {
      issues.push(`Token generation failed: ${results.token.error}`);
      recommendations.push('Check Firebase configuration and permissions');
    } else if (results.token.available && results.token.isMock) {
      issues.push('Generated token is mock/test token');
      recommendations.push('Ensure proper Firebase configuration');
    }
    
    return {
      totalIssues: issues.length,
      issues,
      recommendations,
      overallStatus: issues.length === 0 ? 'HEALTHY' : issues.length <= 2 ? 'NEEDS_ATTENTION' : 'CRITICAL'
    };
  }
}

export default NotificationDiagnostics;
