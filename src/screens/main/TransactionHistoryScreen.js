import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ledgerAPI } from '../../services/api';

const TransactionHistoryScreen = ({ navigation }) => {
  const [transactions, setTransactions] = useState([]);
  const [balanceSummary, setBalanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = async (pageNum = 1, refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      const params = {
        page: pageNum,
        limit: 20,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      };

      const response = await ledgerAPI.getMyTransactions(params);
      
      if (response.success) {
        const newTransactions = response.data.transactions || [];
        
        if (pageNum === 1 || refresh) {
          setTransactions(newTransactions);
        } else {
          setTransactions(prev => [...prev, ...newTransactions]);
        }
        
        setHasMore(newTransactions.length === params.limit);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Alert.alert('Error', 'Failed to load transaction history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchBalanceSummary = async () => {
    try {
      const response = await ledgerAPI.getBalanceSummary();
      if (response.success) {
        setBalanceSummary(response.data);
      }
    } catch (error) {
      console.error('Error fetching balance summary:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions(1, true);
      fetchBalanceSummary();
    }, [])
  );

  const onRefresh = () => {
    fetchTransactions(1, true);
    fetchBalanceSummary();
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchTransactions(page + 1);
    }
  };

  const getTransactionIcon = (type, reason) => {
    switch (reason) {
      case 'consultation_earning':
        return { name: 'cash', color: '#4CAF50' };
      case 'withdrawal':
        return { name: 'arrow-up-circle', color: '#2196F3' };
      case 'bonus_earning':
        return { name: 'gift', color: '#FF9800' };
      case 'admin_adjustment':
        return { name: 'settings', color: '#607D8B' };
      case 'penalty':
        return { name: 'warning', color: '#F44336' };
      default:
        return { 
          name: type === 'credit' ? 'add-circle' : 'remove-circle', 
          color: type === 'credit' ? '#4CAF50' : '#F44336' 
        };
    }
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return `Today, ${date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    } else if (diffDays === 2) {
      return `Yesterday, ${date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    } else {
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const renderTransaction = ({ item }) => {
    const icon = getTransactionIcon(item.transactionType, item.transactionReason);
    const isCredit = item.transactionType === 'credit';

    return (
      <TouchableOpacity 
        style={styles.transactionItem}
        onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}
      >
        <View style={styles.transactionLeft}>
          <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
            <Ionicons name={icon.name} size={24} color={icon.color} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionTitle}>
              {formatTransactionReason(item.transactionReason)}
            </Text>
            <Text style={styles.transactionDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.transactionDate}>
              {formatDate(item.timestamp)}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[
            styles.transactionAmount,
            { color: isCredit ? '#4CAF50' : '#F44336' }
          ]}>
            {isCredit ? '+' : '-'}₹{item.amount.toFixed(2)}
          </Text>
          <Text style={styles.balanceAfter}>
            Balance: ₹{item.newWalletBalance.toFixed(2)}
          </Text>
          {/* Status badges */}
          {!item.reflectedOnLiveWallet && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
          {item.metadata?.status === 'expired' && (
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredText}>Expired</Text>
            </View>
          )}
          {item.metadata?.status === 'cancelled' && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>Cancelled</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Earnings History</Text>
      {balanceSummary && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Current Balance</Text>
            <Text style={styles.summaryValue}>₹{balanceSummary.currentBalance?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Earned</Text>
            <Text style={styles.summaryValueGreen}>₹{balanceSummary.totalCredits?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Withdrawn</Text>
            <Text style={styles.summaryValueRed}>₹{balanceSummary.totalDebits?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cash-outline" size={64} color="#CCCCCC" />
      <Text style={styles.emptyTitle}>No Earnings</Text>
      <Text style={styles.emptyMessage}>Your earnings history will appear here</Text>
    </View>
  );

  if (loading && page === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValueGreen: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  summaryValueRed: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginVertical: 5,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transactionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  balanceAfter: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pendingText: {
    fontSize: 10,
    color: '#856404',
    fontWeight: '500',
  },
  expiredBadge: {
    backgroundColor: '#F8D7DA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  expiredText: {
    fontSize: 10,
    color: '#721C24',
    fontWeight: '500',
  },
  cancelledBadge: {
    backgroundColor: '#D1ECF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  cancelledText: {
    fontSize: 10,
    color: '#0C5460',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default TransactionHistoryScreen;
