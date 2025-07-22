import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotification } from '../context/NotificationContext';
import NotificationDiagnostics from '../utils/NotificationDiagnostics';

const NotificationPermissionToggle = () => {
  const {
    permissionStatus,
    tokenStatus,
    lastTokenError,
    retryCount,
    requestPermissions,
    refreshPermissionStatus,
    retryTokenGeneration
  } = useNotification();

  const [isLoading, setIsLoading] = useState(false);

  // Refresh permission status when component mounts
  useEffect(() => {
    refreshPermissionStatus();
  }, []);

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Enabled';
      case 'denied':
        return 'Disabled';
      case 'undetermined':
        return 'Not Set';
      case 'unavailable':
        return 'Unavailable';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getTokenStatusText = () => {
    switch (tokenStatus) {
      case 'success':
        return 'Active';
      case 'generating':
        return 'Connecting...';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (permissionStatus === 'granted' && tokenStatus === 'success') {
      return '#10B981'; // Green - everything working
    } else if (permissionStatus === 'granted' && tokenStatus === 'generating') {
      return '#F59E0B'; // Yellow - permission granted but token generating
    } else {
      return '#EF4444'; // Red - issues
    }
  };

  const handleTogglePress = async () => {
    setIsLoading(true);
    
    try {
      if (permissionStatus === 'granted') {
        // If already granted, guide user to settings to disable
        Alert.alert(
          'Disable Notifications',
          'To disable notifications, you need to go to your device settings:\n\n' +
          '1. Open device Settings\n' +
          '2. Find "Apps" or "Applications"\n' +
          '3. Find "Astrologer App"\n' +
          '4. Tap "Notifications"\n' +
          '5. Turn off notifications',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
      } else if (permissionStatus === 'denied') {
        // If denied, guide user to settings to enable
        Alert.alert(
          'Enable Notifications',
          'Notifications are currently disabled. To receive booking alerts and important updates, please:\n\n' +
          '1. Open device Settings\n' +
          '2. Find "Apps" or "Applications"\n' +
          '3. Find "Astrologer App"\n' +
          '4. Tap "Notifications"\n' +
          '5. Turn on notifications\n\n' +
          'Then return to the app and tap "Retry" below.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
      } else {
        // If undetermined, request permissions
        const result = await requestPermissions();
        
        if (result.status === 'denied' && !result.canAskAgain) {
          Alert.alert(
            'Permission Denied',
            'Notification permissions were denied. To enable notifications, please go to your device settings and manually enable them for this app.',
            [
              { text: 'OK', style: 'default' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error handling notification toggle:', error);
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryPress = async () => {
    setIsLoading(true);
    
    try {
      // First refresh permission status
      const currentStatus = await refreshPermissionStatus();
      
      if (currentStatus === 'granted') {
        // If permissions are now granted, retry token generation
        await retryTokenGeneration();
      } else {
        // If still no permissions, show guidance
        Alert.alert(
          'Permissions Required',
          'Notification permissions are required to receive booking alerts. Please enable them in your device settings first.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error retrying notifications:', error);
      Alert.alert('Error', 'Failed to retry notification setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const results = await NotificationDiagnostics.runFullDiagnostics();
      
      // Show summary in alert
      const summary = results.summary;
      Alert.alert(
        `Diagnostics: ${summary.overallStatus}`,
        `Found ${summary.totalIssues} issue(s)\n\n` +
        (summary.issues.length > 0 ? `Issues:\n${summary.issues.slice(0, 3).join('\n')}\n\n` : '') +
        (summary.recommendations.length > 0 ? `Recommendations:\n${summary.recommendations.slice(0, 3).join('\n')}` : ''),
        [
          { text: 'OK', style: 'default' },
          { text: 'View Console', onPress: () => console.log('Full diagnostics:', results) }
        ]
      );
    } catch (error) {
      Alert.alert('Diagnostic Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotificationExplanation = () => {
    Alert.alert(
      'Why Enable Notifications?',
      'Notifications help you:\n\n' +
      '• Receive instant booking requests from users\n' +
      '• Get alerts when consultations are about to start\n' +
      '• Stay informed about payment updates\n' +
      '• Never miss important platform updates\n\n' +
      'Without notifications, you may miss booking opportunities and important information.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="notifications" size={24} color="#6B7280" />
          <Text style={styles.title}>Push Notifications</Text>
          <TouchableOpacity onPress={showNotificationExplanation} style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.toggleContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#8A2BE2" />
          ) : (
            <Switch
              value={permissionStatus === 'granted'}
              onValueChange={handleTogglePress}
              trackColor={{ false: '#E5E7EB', true: '#8A2BE2' }}
              thumbColor={permissionStatus === 'granted' ? '#FFFFFF' : '#9CA3AF'}
              disabled={isLoading}
            />
          )}
        </View>
      </View>

      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Permission Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getPermissionStatusText()}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Service Status:</Text>
          <View style={styles.serviceStatusContainer}>
            <Text style={[styles.serviceStatusText, { color: getStatusColor() }]}>
              {getTokenStatusText()}
            </Text>
            {tokenStatus === 'generating' && (
              <ActivityIndicator size="small" color={getStatusColor()} style={styles.statusSpinner} />
            )}
          </View>
        </View>

        {lastTokenError && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{lastTokenError}</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {(tokenStatus === 'failed' || lastTokenError) && permissionStatus === 'granted' && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetryPress}
              disabled={isLoading}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>
                Retry {retryCount > 0 && `(${retryCount})`}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.diagnosticButton}
            onPress={runDiagnostics}
            disabled={isLoading}
          >
            <Ionicons name="medical" size={16} color="#8A2BE2" />
            <Text style={styles.diagnosticButtonText}>Diagnose</Text>
          </TouchableOpacity>
        </View>
      </View>

      {permissionStatus !== 'granted' && (
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            Enable notifications to receive booking requests and important updates instantly.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  infoButton: {
    marginLeft: 8,
    padding: 4,
  },
  toggleContainer: {
    marginLeft: 16,
  },
  statusContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  serviceStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusSpinner: {
    marginLeft: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 6,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  diagnosticButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#8A2BE2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  diagnosticButtonText: {
    color: '#8A2BE2',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  helpContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default NotificationPermissionToggle;
