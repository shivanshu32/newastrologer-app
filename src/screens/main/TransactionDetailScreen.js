import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TransactionDetailScreen = ({ route, navigation }) => {
  const { transaction } = route.params;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTransactionReason = (reason) => {
    const reasonMap = {
      'consultation_earning': 'Consultation Earning',
      'withdrawal': 'Withdrawal',
      'bonus_earning': 'Bonus Earning',
      'admin_adjustment': 'Admin Adjustment',
      'penalty': 'Penalty'
    };
    return reasonMap[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusColor = (reflected) => {
    return reflected ? '#4CAF50' : '#FF9800';
  };

  const getStatusText = (reflected) => {
    return reflected ? 'Completed' : 'Pending Sync';
  };

  const copyToClipboard = (text, label) => {
    // In a real app, you'd use Clipboard API
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const renderMetadataItem = (key, value) => {
    if (typeof value === 'object' && value !== null) {
      return (
        <View key={key} style={styles.metadataSection}>
          <Text style={styles.metadataTitle}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Text>
          {Object.entries(value).map(([subKey, subValue]) => (
            <View key={subKey} style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>{subKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Text>
              <Text style={styles.metadataValue}>
                {typeof subValue === 'number' && (subKey.toLowerCase().includes('amount') || subKey.toLowerCase().includes('earning') || subKey.toLowerCase().includes('commission'))
                  ? `₹${subValue.toFixed(2)}` 
                  : String(subValue)}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View key={key} style={styles.metadataItem}>
        <Text style={styles.metadataLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Text>
        <Text style={styles.metadataValue}>
          {typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('earning') || key.toLowerCase().includes('commission'))
            ? `₹${value.toFixed(2)}` 
            : String(value)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[
            styles.amountContainer,
            { backgroundColor: transaction.transactionType === 'credit' ? '#E8F5E8' : '#FFEBEE' }
          ]}>
            <Text style={[
              styles.amountText,
              { color: transaction.transactionType === 'credit' ? '#4CAF50' : '#F44336' }
            ]}>
              {transaction.transactionType === 'credit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
            </Text>
            <Text style={styles.transactionType}>
              {formatTransactionReason(transaction.transactionReason)}
            </Text>
          </View>
          
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(transaction.reflectedOnLiveWallet) + '20' }
          ]}>
            <Ionicons 
              name={transaction.reflectedOnLiveWallet ? 'checkmark-circle' : 'time'} 
              size={16} 
              color={getStatusColor(transaction.reflectedOnLiveWallet)} 
            />
            <Text style={[
              styles.statusText,
              { color: getStatusColor(transaction.reflectedOnLiveWallet) }
            ]}>
              {getStatusText(transaction.reflectedOnLiveWallet)}
            </Text>
          </View>
        </View>

        {/* Transaction Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Details</Text>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Transaction ID</Text>
            <TouchableOpacity 
              style={styles.copyableValue}
              onPress={() => copyToClipboard(transaction._id, 'Transaction ID')}
            >
              <Text style={styles.detailValue}>{transaction._id}</Text>
              <Ionicons name="copy-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Date & Time</Text>
            <Text style={styles.detailValue}>{formatDate(transaction.timestamp)}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailValue}>{transaction.description}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Previous Balance</Text>
            <Text style={styles.detailValue}>₹{transaction.previousWalletBalance.toFixed(2)}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>New Balance</Text>
            <Text style={styles.detailValue}>₹{transaction.newWalletBalance.toFixed(2)}</Text>
          </View>

          {transaction.referenceId && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Reference ID</Text>
              <TouchableOpacity 
                style={styles.copyableValue}
                onPress={() => copyToClipboard(transaction.referenceId, 'Reference ID')}
              >
                <Text style={styles.detailValue}>{transaction.referenceId}</Text>
                <Ionicons name="copy-outline" size={16} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* System Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Information</Text>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Source</Text>
            <Text style={styles.detailValue}>{transaction.source}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Initiated By</Text>
            <Text style={styles.detailValue}>{transaction.initiatedBy}</Text>
          </View>

          {transaction.syncAttempts > 0 && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Sync Attempts</Text>
              <Text style={styles.detailValue}>{transaction.syncAttempts}</Text>
            </View>
          )}

          {transaction.lastSyncError && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Last Sync Error</Text>
              <Text style={[styles.detailValue, { color: '#F44336' }]}>
                {transaction.lastSyncError}
              </Text>
            </View>
          )}
        </View>

        {/* Metadata */}
        {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earning Breakdown</Text>
            {Object.entries(transaction.metadata).map(([key, value]) => 
              renderMetadataItem(key, value)
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  amountContainer: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  amountText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  transactionType: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  copyableValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  metadataSection: {
    marginBottom: 15,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  metadataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingLeft: 15,
  },
  metadataLabel: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  metadataValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
});

export default TransactionDetailScreen;
