import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import versionService from '../services/versionService';

const useVersionCheck = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);

  const checkForUpdates = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsChecking(true);
      }
      setError(null);

      console.log('Checking for app updates...');
      const updateData = await versionService.checkForUpdate();
      
      console.log('Update check result:', updateData);
      setUpdateInfo(updateData);

      return updateData;
    } catch (err) {
      console.error('Version check failed:', err);
      setError(err.message);
      
      // Return safe defaults on error
      return {
        updateRequired: false,
        latestVersion: versionService.getCurrentVersion(),
        minimumVersion: versionService.getCurrentVersion(),
        updateMessage: '',
        forceUpdate: false,
        playStoreUrl: versionService.getDefaultPlayStoreUrl(),
      };
    } finally {
      if (showLoading) {
        setIsChecking(false);
      }
    }
  };

  const checkForUpdatesOnLaunch = async () => {
    const updateData = await checkForUpdates(false);
    
    if (updateData.updateRequired) {
      console.log('Update required, showing update screen');
      return updateData;
    }
    
    return null;
  };

  // Mock function for testing - remove in production
  const mockForceUpdate = async () => {
    try {
      setIsChecking(true);
      const mockData = await versionService.mockVersionCheck(true);
      setUpdateInfo(mockData);
      return mockData;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    updateInfo,
    isChecking,
    error,
    checkForUpdates,
    checkForUpdatesOnLaunch,
    mockForceUpdate, // Remove in production
  };
};

export default useVersionCheck;
