import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NotificationDiagnostics from '../utils/NotificationDiagnostics';

const NotificationDiagnosticsScreen = ({ navigation }) => {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const results = await NotificationDiagnostics.runFullDiagnostics();
      setDiagnostics(results);
    } catch (error) {
      console.error('Diagnostics failed:', error);
      Alert.alert('Error', 'Failed to run diagnostics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'HEALTHY': return '#10B981';
      case 'NEEDS_ATTENTION': return '#F59E0B';
      case 'CRITICAL': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'HEALTHY': return 'checkmark-circle';
      case 'NEEDS_ATTENTION': return 'warning';
      case 'CRITICAL': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const renderSection = (title, data, icon) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color="#8A2BE2" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {typeof data === 'object' ? (
          Object.entries(data).map(([key, value]) => (
            <View key={key} style={styles.dataRow}>
              <Text style={styles.dataKey}>{key}:</Text>
              <Text style={styles.dataValue}>
                {typeof value === 'boolean' ? (value ? '✅' : '❌') : 
                 typeof value === 'object' ? JSON.stringify(value) : 
                 String(value)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.dataValue}>{String(data)}</Text>
        )}
      </View>
    </View>
  );

  const renderIssues = (issues) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="warning" size={20} color="#EF4444" />
        <Text style={styles.sectionTitle}>Issues Found ({issues.length})</Text>
      </View>
      <View style={styles.sectionContent}>
        {issues.map((issue, index) => (
          <View key={index} style={styles.issueRow}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.issueText}>{issue}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderRecommendations = (recommendations) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="bulb" size={20} color="#F59E0B" />
        <Text style={styles.sectionTitle}>Recommendations ({recommendations.length})</Text>
      </View>
      <View style={styles.sectionContent}>
        {recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationRow}>
            <Ionicons name="arrow-forward" size={16} color="#F59E0B" />
            <Text style={styles.recommendationText}>{rec}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Diagnostics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Running diagnostics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Diagnostics</Text>
        <TouchableOpacity onPress={runDiagnostics}>
          <Ionicons name="refresh" size={24} color="#8A2BE2" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {diagnostics && (
          <>
            {/* Overall Status */}
            <View style={[styles.statusCard, { borderColor: getStatusColor(diagnostics.summary.overallStatus) }]}>
              <View style={styles.statusHeader}>
                <Ionicons 
                  name={getStatusIcon(diagnostics.summary.overallStatus)} 
                  size={24} 
                  color={getStatusColor(diagnostics.summary.overallStatus)} 
                />
                <Text style={[styles.statusText, { color: getStatusColor(diagnostics.summary.overallStatus) }]}>
                  {diagnostics.summary.overallStatus}
                </Text>
              </View>
              <Text style={styles.statusDescription}>
                {diagnostics.summary.totalIssues === 0 
                  ? 'All notification systems are working properly' 
                  : `${diagnostics.summary.totalIssues} issue(s) found`}
              </Text>
            </View>

            {/* Issues */}
            {diagnostics.summary.issues.length > 0 && renderIssues(diagnostics.summary.issues)}

            {/* Recommendations */}
            {diagnostics.summary.recommendations.length > 0 && renderRecommendations(diagnostics.summary.recommendations)}

            {/* Detailed Results */}
            <Text style={styles.detailsHeader}>Detailed Results</Text>
            
            {renderSection('Environment', diagnostics.environment, 'phone-portrait')}
            {renderSection('Device', diagnostics.device, 'hardware-chip')}
            {renderSection('Permissions', diagnostics.permissions, 'shield-checkmark')}
            {renderSection('Expo Config', diagnostics.expo, 'settings')}
            {renderSection('Firebase', diagnostics.firebase, 'flame')}
            {renderSection('Token Generation', diagnostics.token, 'key')}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => {
                  Alert.alert(
                    'Diagnostic Results',
                    'Check the console logs for detailed diagnostic information.',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Ionicons name="document-text" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>View Console Logs</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.retryButton]} 
                onPress={runDiagnostics}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Run Again</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  sectionContent: {
    paddingLeft: 28,
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  dataKey: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    minWidth: 120,
  },
  dataValue: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  issueText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#F59E0B',
    marginLeft: 8,
    flex: 1,
  },
  detailsHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginVertical: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default NotificationDiagnosticsScreen;
