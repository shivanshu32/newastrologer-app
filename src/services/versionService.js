import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

class VersionService {
  constructor() {
    // Backend URL - update for production
    this.baseURL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';
    this.appType = 'astrologer';
    this.currentVersion = this.getCurrentVersionFromDevice();
    this.playStoreUrl = 'https://play.google.com/store/apps/details?id=com.jyotishcallastrologerapp&pli=1';
  }

  /**
   * Get current app version using multiple fallback methods
   * This ensures version retrieval works in both development and production
   */
  getCurrentVersionFromDevice() {
    try {
      // Method 1: Expo Application (most reliable for production)
      if (Application.nativeApplicationVersion) {
        console.log('Astrologer App - Version from Application.nativeApplicationVersion:', Application.nativeApplicationVersion);
        return Application.nativeApplicationVersion;
      }

      // Method 2: Expo Constants (works in development and some production builds)
      if (Constants.expoConfig?.version) {
        console.log('Astrologer App - Version from Constants.expoConfig.version:', Constants.expoConfig?.version);
        return Constants.expoConfig.version;
      }

      // Method 3: Expo Constants manifest (legacy fallback)
      if (Constants.manifest?.version) {
        console.log('Astrologer App - Version from Constants.manifest.version:', Constants.manifest.version);
        return Constants.manifest.version;
      }

      // Method 4: Expo Constants manifest2 (newer Expo versions)
      if (Constants.manifest2?.extra?.expoClient?.version) {
        console.log('Astrologer App - Version from Constants.manifest2:', Constants.manifest2.extra.expoClient.version);
        return Constants.manifest2.extra.expoClient.version;
      }

      // Final fallback
      console.warn('Astrologer App - Could not retrieve version from any source, using fallback');
      return '1.0.0';
    } catch (error) {
      console.error('Astrologer App - Error retrieving app version:', error);
      return '1.0.0';
    }
  }

  /**
   * Get current app version
   */
  getCurrentVersion() {
    return this.currentVersion;
  }

  /**
   * Fetch latest version from Play Store
   */
  async getPlayStoreVersion() {
    try {
      console.log('Astrologer App - Fetching latest version from Play Store...');
      
      const response = await fetch(this.playStoreUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Play Store page');
      }

      const html = await response.text();
      
      // Extract version from Play Store HTML
      // Look for version pattern in the HTML
      const versionMatch = html.match(/"([0-9]+\.[0-9]+\.[0-9]+)"/g);
      
      if (versionMatch && versionMatch.length > 0) {
        // Get the most likely version string (usually the first one found)
        const version = versionMatch[0].replace(/"/g, '');
        console.log('Astrologer App - Play Store version found:', version);
        return version;
      }
      
      // Alternative pattern matching
      const altVersionMatch = html.match(/Current Version[\s\S]*?([0-9]+\.[0-9]+\.[0-9]+)/i);
      if (altVersionMatch && altVersionMatch[1]) {
        console.log('Astrologer App - Play Store version found (alt method):', altVersionMatch[1]);
        return altVersionMatch[1];
      }
      
      throw new Error('Version not found in Play Store page');
    } catch (error) {
      console.error('Astrologer App - Failed to fetch Play Store version:', error);
      return null;
    }
  }

  /**
   * Check if app update is required
   * Enhanced version that checks Play Store first, then falls back to backend
   */
  async checkForUpdate() {
    try {
      console.log('Astrologer App - Checking for app updates...');
      
      // Step 1: Try to get latest version from Play Store
      const playStoreVersion = await this.getPlayStoreVersion();
      
      if (playStoreVersion) {
        // Compare current version with Play Store version
        const isUpdateRequired = this.compareVersions(this.currentVersion, playStoreVersion) < 0;
        
        if (isUpdateRequired) {
          console.log(`Astrologer App - Update required: Current ${this.currentVersion} < Play Store ${playStoreVersion}`);
          return {
            updateRequired: true,
            latestVersion: playStoreVersion,
            minimumVersion: playStoreVersion,
            updateMessage: `A new version (${playStoreVersion}) is available on Play Store. Please update to continue using the app.`,
            forceUpdate: true,
            playStoreUrl: this.playStoreUrl,
          };
        } else {
          console.log(`Astrologer App - No update required: Current ${this.currentVersion} >= Play Store ${playStoreVersion}`);
          return {
            updateRequired: false,
            latestVersion: playStoreVersion,
            minimumVersion: this.currentVersion,
            updateMessage: '',
            forceUpdate: false,
            playStoreUrl: this.playStoreUrl,
          };
        }
      }
      
      // Step 2: Fallback to backend API if Play Store check fails
      console.log('Astrologer App - Play Store check failed, falling back to backend API...');
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
        throw new Error('Failed to check version from backend');
      }

      const data = await response.json();
      
      return {
        updateRequired: data.updateRequired || false,
        latestVersion: data.latestVersion || this.currentVersion,
        minimumVersion: data.minimumVersion || this.currentVersion,
        updateMessage: data.updateMessage || 'A new version is available. Please update to continue using the app.',
        forceUpdate: data.forceUpdate || false,
        playStoreUrl: this.playStoreUrl,
      };
    } catch (error) {
      console.error('Astrologer App - Version check failed:', error);
      
      // Final fallback: Return no update required if all methods fail
      return {
        updateRequired: false,
        latestVersion: this.currentVersion,
        minimumVersion: this.currentVersion,
        updateMessage: '',
        forceUpdate: false,
        playStoreUrl: this.playStoreUrl,
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
