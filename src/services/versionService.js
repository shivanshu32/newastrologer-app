import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

class VersionService {
  constructor() {
    // Backend URL - update for production
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api'
      : 'http://localhost:5001/api';
    this.appType = 'astrologer';
    this.currentVersion = Constants.expoConfig?.version || '1.0.0';
  }

  /**
   * Get current app version
   */
  getCurrentVersion() {
    return this.currentVersion;
  }

  /**
   * Check if app update is required
   * This can be implemented in multiple ways:
   * 1. Backend API that returns minimum required version
   * 2. Firebase Remote Config
   * 3. Play Store API (more complex)
   * 
   * For now, implementing with backend API approach
   */
  async checkForUpdate() {
    try {
      console.log('Checking for app updates...');
      
      // Method 1: Backend API approach
      const response = await fetch(`${this.baseURL}/version-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appType: 'astrologer',
          currentVersion: this.currentVersion,
          platform: Platform.OS,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check version');
      }

      const data = await response.json();
      
      return {
        updateRequired: data.updateRequired || false,
        latestVersion: data.latestVersion || this.currentVersion,
        minimumVersion: data.minimumVersion || this.currentVersion,
        updateMessage: data.updateMessage || 'A new version is available. Please update to continue using the app.',
        forceUpdate: data.forceUpdate || false,
        playStoreUrl: data.playStoreUrl || this.getDefaultPlayStoreUrl(),
      };
    } catch (error) {
      console.error('Version check failed:', error);
      
      // Fallback: Return no update required if service fails
      // In production, you might want to handle this differently
      return {
        updateRequired: false,
        latestVersion: this.currentVersion,
        minimumVersion: this.currentVersion,
        updateMessage: '',
        forceUpdate: false,
        playStoreUrl: this.getDefaultPlayStoreUrl(),
      };
    }
  }

  /**
   * Compare version strings (semantic versioning)
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  /**
   * Check if current version is less than minimum required version
   */
  isUpdateRequired(minimumVersion) {
    return this.compareVersions(this.currentVersion, minimumVersion) < 0;
  }

  /**
   * Get default Play Store URL for the app
   */
  getDefaultPlayStoreUrl() {
    if (Platform.OS === 'android') {
      // Replace with your actual package name
      return 'https://play.google.com/store/apps/details?id=com.jyotishcall.astrologerapp';
    } else if (Platform.OS === 'ios') {
      // Replace with your actual App Store ID
      return 'https://apps.apple.com/app/id1234567891';
    }
    return 'https://play.google.com/store/apps/details?id=com.jyotishcall.astrologerapp';
  }

  /**
   * Open Play Store/App Store for update
   */
  async openStore() {
    const { Linking } = require('react-native');
    const storeUrl = this.getDefaultPlayStoreUrl();
    
    try {
      const supported = await Linking.canOpenURL(storeUrl);
      if (supported) {
        await Linking.openURL(storeUrl);
      } else {
        console.error('Cannot open store URL:', storeUrl);
      }
    } catch (error) {
      console.error('Failed to open store:', error);
    }
  }

  /**
   * Mock version check for testing (remove in production)
   */
  async mockVersionCheck(forceUpdate = false) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          updateRequired: forceUpdate,
          latestVersion: '1.1.0',
          minimumVersion: forceUpdate ? '1.1.0' : '1.0.0',
          updateMessage: 'A new version with exciting features is available! Please update to continue using the app.',
          forceUpdate: forceUpdate,
          playStoreUrl: this.getDefaultPlayStoreUrl(),
        });
      }, 1000);
    });
  }
}

export default new VersionService();
